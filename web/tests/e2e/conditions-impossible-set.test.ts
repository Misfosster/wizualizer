import { test, expect } from "@playwright/test";
import { parseDocument } from "../../src/utils/apl-parser/document";
import { computeImpossibleSet } from "../../src/utils/filters/compute-impossible-set";
import {
  EMPTY_CONDITION_OVERRIDES,
  type ConditionOverrides,
} from "../../src/utils/conditions/types";
import type { TalentSelectionResult } from "../../src/utils/talents/types";

const SHAMAN_DOC = `
shaman="Test"
spec=enhancement
actions=auto_attack
actions+=/lava_lash,if=buff.hot_hand.up
actions+=/stormstrike,if=talent.storm_unleashed.enabled
`;

function parseOrThrow(text: string) {
  const result = parseDocument(text);
  if (!result.ok) {
    throw new Error(`Parse failed: ${result.error}`);
  }
  return result.document;
}

function selectionsFor(
  index: number,
  result: TalentSelectionResult,
): ReadonlyMap<number, TalentSelectionResult> {
  return new Map([[index, result]]);
}

test("no selections, no overrides -> nothing filtered", () => {
  const doc = parseOrThrow(SHAMAN_DOC);
  const result = computeImpossibleSet(doc);
  expect(result.actionIds.size).toBe(0);
  expect(result.hiddenCountByProfile.size).toBe(0);
});

test("global override forcing buff.hot_hand.up = false hides lava_lash", () => {
  const doc = parseOrThrow(SHAMAN_DOC);
  const overrides: ConditionOverrides = {
    ...EMPTY_CONDITION_OVERRIDES,
    global: { "buff.hot_hand.up": false },
  };
  const result = computeImpossibleSet(doc, { conditionOverrides: overrides });
  expect(result.hiddenCountByProfile.get(0)).toBe(1);
  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual(["lava_lash"]);
});

test("global override on a talent atom outranks an empty selection map", () => {
  const doc = parseOrThrow(SHAMAN_DOC);
  const selections = selectionsFor(0, {
    status: { kind: "decoded" },
    selections: { storm_unleashed: 1 },
  });
  const overrides: ConditionOverrides = {
    ...EMPTY_CONDITION_OVERRIDES,
    global: { "talent.storm_unleashed.enabled": false },
  };
  const result = computeImpossibleSet(doc, {
    talentSelectionsByProfile: selections,
    conditionOverrides: overrides,
  });
  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual(["stormstrike"]);
});

test("per-profile override only applies to the named profile", () => {
  const doc = parseOrThrow(`
shaman="A"
actions=lava_lash,if=buff.hot_hand.up

shaman="B"
actions=lava_lash,if=buff.hot_hand.up
`);
  const overrides: ConditionOverrides = {
    global: {},
    byProfile: {
      A: { "buff.hot_hand.up": false },
    },
  };
  const result = computeImpossibleSet(doc, { conditionOverrides: overrides });
  expect(result.hiddenCountByProfile.get(0)).toBe(1);
  expect(result.hiddenCountByProfile.has(1)).toBe(false);
});

test("missing-catalog talents stay untouched but a manual override still applies", () => {
  const doc = parseOrThrow(SHAMAN_DOC);
  const selections = selectionsFor(0, {
    status: { kind: "missing_catalog" },
    selections: {},
  });
  const overrides: ConditionOverrides = {
    ...EMPTY_CONDITION_OVERRIDES,
    global: { "buff.hot_hand.up": false },
  };
  const result = computeImpossibleSet(doc, {
    talentSelectionsByProfile: selections,
    conditionOverrides: overrides,
  });
  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual(["lava_lash"]);
});
