import { test, expect } from "@playwright/test";
import {
  buildGraph,
  getActionNodeId,
  getBlockNodeId,
  getRootNodeId,
  type GraphResult,
} from "../../src/utils/apl-parser/build-graph";
import { parseDocument, type AplDocument } from "../../src/utils/apl-parser/document";
import type {
  TalentSelectionResult,
  TalentState,
} from "../../src/utils/talents/types";
import type { BlockNodeData, RootNodeData } from "../../src/components/nodes/types";

function parseOrThrow(text: string): AplDocument {
  const result = parseDocument(text);
  if (!result.ok) {
    throw new Error(
      `Parse failed on line ${String(result.lineNumber)}: ${result.error}\n${result.lineText}`,
    );
  }
  return result.document;
}

function decoded(selections: Record<string, number>): TalentSelectionResult {
  return { status: { kind: "decoded" }, selections };
}

function nodeById(graph: GraphResult, id: string) {
  return graph.nodes.find((node) => node.id === id);
}

function actionTalentState(graph: GraphResult, id: string): TalentState | undefined {
  const node = nodeById(graph, id);
  if (!node || node.type === "root" || node.type === "block") {
    return undefined;
  }
  return (node.data as { talentState?: TalentState }).talentState;
}

function isImpossibleEdge(style: unknown): boolean {
  if (!style || typeof style !== "object") {
    return false;
  }
  const opacity = (style as { opacity?: unknown }).opacity;
  return opacity === 0.4;
}

const SIMPLE_APL = [
  'shaman="Demo"',
  "actions=lightning_bolt,if=talent.foo",
  "actions+=/lava_burst,if=talent.bar",
].join("\n");

const APL_WITH_CALL_TARGET = [
  'shaman="Demo"',
  "actions=call_action_list,name=cds,if=talent.invoker",
  "actions.cds=heroism,if=talent.bar",
].join("\n");

test("Off mode: no talentSummary, no talentState tags, ignores selections", () => {
  const document = parseOrThrow(SIMPLE_APL);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "off",
    talentSelectionsByProfile: new Map([[0, decoded({ bar: 1 })]]),
  });

  expect(result.talentSummary).toBeUndefined();
  expect(nodeById(result, getActionNodeId(0, "actions", 0))).toBeTruthy();
  expect(nodeById(result, getActionNodeId(0, "actions", 1))).toBeTruthy();
  for (const node of result.nodes) {
    expect((node.data as { talentState?: TalentState }).talentState).toBeUndefined();
  }
});

test("Off mode default (no options) matches Off mode with explicit options", () => {
  const document = parseOrThrow(SIMPLE_APL);
  const noOptions = buildGraph(document);
  const explicitOff = buildGraph(document, undefined, undefined, {
    talentRenderMode: "off",
  });

  expect(noOptions.nodes.length).toBe(explicitOff.nodes.length);
  expect(noOptions.edges.length).toBe(explicitOff.edges.length);
  expect(explicitOff.talentSummary).toBeUndefined();
});

test("Dim mode tags impossible action with talentState=impossible, others untagged", () => {
  const document = parseOrThrow(SIMPLE_APL);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "dim",
    talentSelectionsByProfile: new Map([[0, decoded({ bar: 1 })]]),
  });

  expect(actionTalentState(result, getActionNodeId(0, "actions", 0))).toBe("impossible");
  expect(actionTalentState(result, getActionNodeId(0, "actions", 1))).toBeUndefined();
});

test("Dim mode tags condition subtree of an impossible action", () => {
  const document = parseOrThrow(SIMPLE_APL);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "dim",
    talentSelectionsByProfile: new Map([[0, decoded({ bar: 1 })]]),
  });

  const conditionNodes = result.nodes.filter(
    (node) =>
      (node.type === "condition" || node.type === "valueExpression" || node.type === "container") &&
      node.id.includes("__actions__0__"),
  );
  expect(conditionNodes.length).toBeGreaterThan(0);
  for (const node of conditionNodes) {
    expect((node.data as { talentState?: TalentState }).talentState).toBe("impossible");
  }

  const survivorConditionNodes = result.nodes.filter(
    (node) =>
      (node.type === "condition" || node.type === "valueExpression" || node.type === "container") &&
      node.id.includes("__actions__1__"),
  );
  for (const node of survivorConditionNodes) {
    expect((node.data as { talentState?: TalentState }).talentState).toBeUndefined();
  }
});

test("Dim mode dims edges sourced from an impossible action", () => {
  const document = parseOrThrow(SIMPLE_APL);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "dim",
    talentSelectionsByProfile: new Map([[0, decoded({ bar: 1 })]]),
  });

  const impossibleActionId = getActionNodeId(0, "actions", 0);
  const survivorActionId = getActionNodeId(0, "actions", 1);

  const dimmedEdges = result.edges.filter(
    (edge) => edge.source === impossibleActionId,
  );
  expect(dimmedEdges.length).toBeGreaterThan(0);
  for (const edge of dimmedEdges) {
    expect(isImpossibleEdge(edge.style)).toBe(true);
  }

  const blockToImpossible = result.edges.find(
    (edge) => edge.target === impossibleActionId,
  );
  expect(blockToImpossible).toBeTruthy();
  expect(isImpossibleEdge(blockToImpossible?.style)).toBe(true);

  const blockToSurvivor = result.edges.find(
    (edge) => edge.target === survivorActionId,
  );
  expect(blockToSurvivor).toBeTruthy();
  expect(isImpossibleEdge(blockToSurvivor?.style)).toBe(false);
});

test("Dim mode preserves block actionCount and root counts", () => {
  const document = parseOrThrow(SIMPLE_APL);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "dim",
    talentSelectionsByProfile: new Map([[0, decoded({ bar: 1 })]]),
  });

  const block = nodeById(result, getBlockNodeId(0, "actions"));
  expect((block?.data as BlockNodeData).actionCount).toBe(2);

  const root = nodeById(result, getRootNodeId(0));
  expect((root?.data as RootNodeData).actionCount).toBe(2);
});

test("Hide mode removes impossible action and its condition subtree", () => {
  const document = parseOrThrow(SIMPLE_APL);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([[0, decoded({ bar: 1 })]]),
  });

  expect(nodeById(result, getActionNodeId(0, "actions", 0))).toBeUndefined();
  expect(nodeById(result, getActionNodeId(0, "actions", 1))).toBeTruthy();

  const orphanedSubtree = result.nodes.filter((node) =>
    node.id.includes("__actions__0__"),
  );
  expect(orphanedSubtree.length).toBe(0);

  const orphanedEdges = result.edges.filter(
    (edge) =>
      edge.source === getActionNodeId(0, "actions", 0) ||
      edge.target === getActionNodeId(0, "actions", 0),
  );
  expect(orphanedEdges.length).toBe(0);
});

test("Hide mode compacts block actionCount to surviving actions", () => {
  const document = parseOrThrow(SIMPLE_APL);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([[0, decoded({ bar: 1 })]]),
  });

  const block = nodeById(result, getBlockNodeId(0, "actions"));
  expect((block?.data as BlockNodeData).actionCount).toBe(1);

  const root = nodeById(result, getRootNodeId(0));
  expect((root?.data as RootNodeData).actionCount).toBe(1);
});

test("Hide mode reports per-profile hidden counts in talentSummary", () => {
  const document = parseOrThrow(SIMPLE_APL);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([[0, decoded({ bar: 1 })]]),
  });

  expect(result.talentSummary?.hiddenActionCountByProfile.get(0)).toBe(1);
});

test("Hide mode keeps mixed OR action when other branch is unknown and prunes false override branch in rendered condition", () => {
  const apl = [
    'shaman="Demo"',
    "actions=crash_lightning,if=!buff.crash_lightning.up|talent.storm_unleashed.enabled",
  ].join("\n");
  const document = parseOrThrow(apl);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([
      [0, { status: { kind: "decoder_pending" }, selections: {} }],
    ]),
    conditionOverrides: {
      global: { "buff.crash_lightning.up": true },
      byProfile: {},
    },
  });

  expect(nodeById(result, getActionNodeId(0, "actions", 0))).toBeTruthy();
  const conditionLabels = result.nodes
    .filter((node) => node.type === "condition")
    .map((node) => String((node.data as { label?: string }).label ?? ""));
  expect(
    conditionLabels.some((label) => label.includes("buff.crash_lightning.up")),
  ).toBe(false);
  expect(
    conditionLabels.some((label) => label.includes("talent.storm_unleashed.enabled")),
  ).toBe(true);
});

test("Dim mode prunes false override branch while keeping unknown OR branch", () => {
  const apl = [
    'shaman="Demo"',
    "actions=crash_lightning,if=!buff.crash_lightning.up|talent.storm_unleashed.enabled",
  ].join("\n");
  const document = parseOrThrow(apl);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "dim",
    talentSelectionsByProfile: new Map([
      [0, { status: { kind: "decoder_pending" }, selections: {} }],
    ]),
    conditionOverrides: {
      global: { "buff.crash_lightning.up": true },
      byProfile: {},
    },
  });

  const conditionLabels = result.nodes
    .filter((node) => node.type === "condition")
    .map((node) => String((node.data as { label?: string }).label ?? ""));
  expect(
    conditionLabels.some((label) => label.includes("buff.crash_lightning.up")),
  ).toBe(false);
  expect(
    conditionLabels.some((label) => label.includes("talent.storm_unleashed.enabled")),
  ).toBe(true);
});

test("Hide mode drops empty unreferenced block and its profile root", () => {
  const apl = [
    'shaman="Demo"',
    "actions=lightning_bolt,if=talent.foo",
  ].join("\n");
  const document = parseOrThrow(apl);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([[0, decoded({})]]),
  });

  expect(nodeById(result, getBlockNodeId(0, "actions"))).toBeUndefined();
  expect(nodeById(result, getRootNodeId(0))).toBeUndefined();
  expect(result.talentSummary?.hiddenActionCountByProfile.get(0)).toBe(1);
});

test("Hide mode keeps an empty block when a surviving call_action_list targets it", () => {
  const document = parseOrThrow(APL_WITH_CALL_TARGET);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([[0, decoded({ invoker: 1 })]]),
  });

  // Block names on the document keep the SimC `actions.` prefix.
  const cdsBlock = nodeById(result, getBlockNodeId(0, "actions.cds"));
  expect(cdsBlock).toBeTruthy();
  expect((cdsBlock?.data as BlockNodeData).actionCount).toBe(0);
  expect(nodeById(result, getActionNodeId(0, "actions.cds", 0))).toBeUndefined();
});

test("Hide mode drops a block when its only invoker is itself impossible", () => {
  const document = parseOrThrow(APL_WITH_CALL_TARGET);
  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([[0, decoded({})]]),
  });

  expect(nodeById(result, getBlockNodeId(0, "actions.cds"))).toBeUndefined();
  expect(nodeById(result, getActionNodeId(0, "actions", 0))).toBeUndefined();
  expect(nodeById(result, getRootNodeId(0))).toBeUndefined();
});

test("Hide mode preserves stable IDs for surviving actions across modes", () => {
  const document = parseOrThrow(SIMPLE_APL);
  const off = buildGraph(document);
  const hide = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([[0, decoded({ bar: 1 })]]),
  });

  const offSurvivor = nodeById(off, getActionNodeId(0, "actions", 1));
  const hideSurvivor = nodeById(hide, getActionNodeId(0, "actions", 1));
  expect(offSurvivor).toBeTruthy();
  expect(hideSurvivor).toBeTruthy();
});

test("Per-profile selections produce per-profile filter results", () => {
  // Two independent profiles. `copy=` only carries syntactic metadata
  // (className/spec/talents) by design; the action lists are independent.
  const apl = [
    'shaman="A"',
    "actions=lightning_bolt,if=talent.foo",
    'mage="B"',
    "actions=fireball,if=talent.foo",
  ].join("\n");
  const document = parseOrThrow(apl);

  const selections = new Map<number, TalentSelectionResult>([
    [0, decoded({})],
    [1, decoded({ foo: 1 })],
  ]);

  const result = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: selections,
  });

  expect(nodeById(result, getActionNodeId(0, "actions", 0))).toBeUndefined();
  expect(nodeById(result, getRootNodeId(0))).toBeUndefined();

  expect(nodeById(result, getActionNodeId(1, "actions", 0))).toBeTruthy();
  expect(nodeById(result, getRootNodeId(1))).toBeTruthy();
  expect(result.talentSummary?.hiddenActionCountByProfile.get(0)).toBe(1);
  expect(result.talentSummary?.hiddenActionCountByProfile.get(1)).toBeUndefined();
});

test("buildGraph is deterministic for identical inputs", () => {
  const document = parseOrThrow(SIMPLE_APL);
  const selections = new Map([[0, decoded({ bar: 1 })]]);
  const a = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: selections,
  });
  const b = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: selections,
  });

  expect(a.nodes.map((n) => n.id)).toEqual(b.nodes.map((n) => n.id));
  expect(a.edges.map((e) => e.id)).toEqual(b.edges.map((e) => e.id));
  for (let i = 0; i < a.nodes.length; i++) {
    expect(a.nodes[i].position).toEqual(b.nodes[i].position);
  }
});

test("Profile dropped in Hide does not consume layout padding", () => {
  const apl = [
    'shaman="Dropped"',
    "actions=lightning_bolt,if=talent.foo",
    'mage="Survives"',
    "actions=fireball",
  ].join("\n");
  const document = parseOrThrow(apl);

  const offResult = buildGraph(document);
  const hideResult = buildGraph(document, undefined, undefined, {
    talentRenderMode: "hide",
    talentSelectionsByProfile: new Map([
      [0, decoded({})],
      [1, decoded({})],
    ]),
  });

  expect(nodeById(hideResult, getRootNodeId(0))).toBeUndefined();
  const survivorRoot = nodeById(hideResult, getRootNodeId(1));
  const offSurvivorRoot = nodeById(offResult, getRootNodeId(1));
  expect(survivorRoot).toBeTruthy();
  expect(offSurvivorRoot).toBeTruthy();
  if (!survivorRoot || !offSurvivorRoot) {
    return;
  }
  // Profile 1 starts higher in Hide because Profile 0 (and its padding) is gone.
  expect(survivorRoot.position.y).toBeLessThan(offSurvivorRoot.position.y);
});
