import { test, expect } from "@playwright/test";
import {
  buildGraph,
  getActionNodeId,
} from "../../src/utils/apl-parser/build-graph";
import {
  parseDocument,
  type AplDocument,
} from "../../src/utils/apl-parser/document";
import type { TalentSelectionResult } from "../../src/utils/talents/types";

/**
 * Regression tests for the "trust gate" in the condition filter.
 *
 * Before this gate existed, a profile that carried a `talents=` line but
 * whose decoder had returned `missing_catalog` (the Phase C stub always
 * does that, and Phase D can still return it when the spec is new) had
 * every `talent.*` reference collapse to `rank=0` -> `false`. That
 * silently nuked real actions like `call_action_list,name=single_totemic`
 * the user's APL contained. The fix: only profiles with
 * `status.kind === "decoded"` participate in filtering.
 */

function parseOrThrow(text: string): AplDocument {
  const result = parseDocument(text);
  if (!result.ok) {
    throw new Error(
      `Parse failed on line ${String(result.lineNumber)}: ${result.error}`,
    );
  }
  return result.document;
}

function missingCatalog(): TalentSelectionResult {
  return { status: { kind: "missing_catalog" }, selections: {} };
}

function decoded(selections: Record<string, number>): TalentSelectionResult {
  return { status: { kind: "decoded" }, selections };
}

const TOTEMIC_APL = [
  'shaman="Totemic"',
  "talents=CcQAAAAAAAAAAAAAAAAAAAAAAMzMjZmZmZmZmZmZGzAAAAA",
  "actions=call_action_list,name=single_totemic,if=talent.surging_totem.enabled",
  "actions.single_totemic=voltaic_blaze",
  "actions.single_totemic+=/lava_lash",
].join("\n");

test("missing_catalog status never filters, even in Hide mode", () => {
  const document = parseOrThrow(TOTEMIC_APL);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([[0, missingCatalog()]]),
  });

  // Every action the user wrote must still be in the graph.
  expect(
    result.nodes.find(
      (n) => n.id === getActionNodeId(0, "actions", 0),
    ),
  ).toBeTruthy();
  expect(
    result.nodes.find(
      (n) => n.id === getActionNodeId(0, "actions.single_totemic", 0),
    ),
  ).toBeTruthy();
  expect(
    result.nodes.find(
      (n) => n.id === getActionNodeId(0, "actions.single_totemic", 1),
    ),
  ).toBeTruthy();

  // And the summary must report zero hidden actions so the panel tells
  // the user "nothing is being filtered right now" rather than silently
  // dropping their actions.
  expect(result.talentSummary?.hiddenActionCountByProfile.size ?? 0).toBe(0);
  expect(result.talentSummary?.hiddenActionsByProfile.size ?? 0).toBe(0);
});

test("decoded status with rank=0 still filters (trust gate is specific, not blanket)", () => {
  const document = parseOrThrow(TOTEMIC_APL);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([[0, decoded({})]]),
  });

  // When the decoder explicitly reports "I saw no surging_totem selected",
  // the call_action_list IS impossible and must be removed. The callee
  // block (actions.single_totemic) can still render on its own because
  // its internal actions aren't talent-gated - dropping it anyway would
  // be a different policy ("drop unreferenced blocks") we have not
  // opted in to.
  expect(
    result.nodes.find(
      (n) => n.id === getActionNodeId(0, "actions", 0),
    ),
  ).toBeUndefined();

  // And the filter summary MUST list the filtered action so the UI can
  // tell the user exactly what went away.
  const hidden = result.talentSummary?.hiddenActionsByProfile.get(0);
  expect(hidden?.length).toBe(1);
  expect(hidden?.[0]?.label).toBe("single_totemic");
});

test("decoded Totemic profile filters Stormbringer-only talent gates", () => {
  const apl = [
    'shaman="Totemic"',
    "actions=call_action_list,name=stormbringer,if=talent.tempest.enabled",
    "actions.stormbringer=lightning_bolt",
  ].join("\n");
  const document = parseOrThrow(apl);

  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([
      [0, decoded({ surging_totem: 1, totemic_rebound: 1 })],
    ]),
  });

  expect(
    result.nodes.find(
      (n) => n.id === getActionNodeId(0, "actions", 0),
    ),
  ).toBeUndefined();
  expect(result.talentSummary?.hiddenActionCountByProfile.get(0)).toBe(1);
  const hidden = result.talentSummary?.hiddenActionsByProfile.get(0);
  expect(hidden?.[0]?.reason).toContain("talent.tempest.enabled");
  expect(hidden?.[0]?.reasonLabel).toBe("talent-decoded");
});

test("hiddenActionsByProfile lists the filtered action with its failing segment", () => {
  const apl = [
    'shaman="Demo"',
    "actions=call_action_list,name=cds,if=talent.surging_totem.enabled",
    "actions.cds=heroism",
  ].join("\n");
  const document = parseOrThrow(apl);

  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "dim",
    talentSelectionsByProfile: new Map([[0, decoded({})]]),
  });

  const hidden = result.talentSummary?.hiddenActionsByProfile.get(0);
  expect(hidden).toBeTruthy();
  expect(hidden?.length).toBe(1);
  const entry = hidden?.[0];
  expect(entry).toBeTruthy();
  if (!entry) {
    throw new Error("unreachable: hidden action entry must exist");
  }

  expect(entry.blockName).toBe("actions");
  expect(entry.spell).toBe("call_action_list");
  // For call_action_list, the row label should surface the target list.
  expect(entry.label).toBe("cds");
  // And the reason should be the failing `if=` clause, pretty-printed.
  expect(entry.reason).toContain("if=");
  expect(entry.reason).toContain("talent.surging_totem.enabled");
  expect(entry.reasonLabel).toBe("talent-decoded");
  expect(entry.lineNumber).toBeGreaterThan(0);
});

test("absent status (no talents= line) never filters", () => {
  const apl = [
    'shaman="Demo"',
    "actions=heroism,if=talent.foo.enabled",
  ].join("\n");
  const document = parseOrThrow(apl);

  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([
      [0, { status: { kind: "absent" }, selections: {} }],
    ]),
  });

  expect(
    result.nodes.find(
      (n) => n.id === getActionNodeId(0, "actions", 0),
    ),
  ).toBeTruthy();
});
