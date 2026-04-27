import { test, expect } from "@playwright/test";
import { parseDocument } from "../../src/utils/apl-parser/document";
import { getProfileScopeKey } from "../../src/utils/apl-parser/profile-scope";
import { computeImpossibleSet } from "../../src/utils/filters/compute-impossible-set";
import {
  EMPTY_CONDITION_OVERRIDES,
  type ConditionOverrides,
} from "../../src/utils/conditions/types";
import type { SemanticSpecCatalog } from "../../src/utils/semantics/types";
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

function catalogFor(
  catalog: Partial<SemanticSpecCatalog>,
): SemanticSpecCatalog {
  return {
    actions: catalog.actions ?? [],
    buffs: catalog.buffs ?? [],
    debuffs: catalog.debuffs ?? [],
    cooldowns: catalog.cooldowns ?? [],
    dots: catalog.dots ?? [],
    talents: catalog.talents ?? [],
    trinkets: catalog.trinkets ?? [],
    equipped: catalog.equipped ?? [],
    setBonuses: catalog.setBonuses ?? [],
    options: catalog.options ?? [],
  };
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

test("numeric override can make a comparison false", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=ascendance,if=cooldown.ascendance.remains<1
`);
  const overrides: ConditionOverrides = {
    ...EMPTY_CONDITION_OVERRIDES,
    global: { "cooldown.ascendance.remains": 5 },
  };
  const result = computeImpossibleSet(doc, { conditionOverrides: overrides });
  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual(["ascendance"]);
});

test("aura up override can make an equivalent stacks comparison false", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=crash_lightning,if=buff.outcrash_lightning.stacks>0
`);
  const overrides: ConditionOverrides = {
    ...EMPTY_CONDITION_OVERRIDES,
    global: { "buff.outcrash_lightning.up": false },
  };
  const result = computeImpossibleSet(doc, { conditionOverrides: overrides });
  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual([
    "crash_lightning",
  ]);
});

test("aura up override hides negated-up and explicit-down checks", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=wait,if=!buff.outcrash_lightning.up
actions+=/crash_lightning,if=buff.outcrash_lightning.down
`);
  const overrides: ConditionOverrides = {
    ...EMPTY_CONDITION_OVERRIDES,
    global: { "buff.outcrash_lightning.up": true },
  };
  const result = computeImpossibleSet(doc, { conditionOverrides: overrides });
  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual([
    "wait",
    "crash_lightning",
  ]);
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

test("rank-gated talent failures are labelled as rank checks", () => {
  const doc = parseOrThrow(`
shaman="A"
actions=stormstrike,if=talent.storm_unleashed.rank>=2
`);
  const selections = selectionsFor(0, {
    status: { kind: "decoded" },
    selections: { storm_unleashed: 1 },
  });

  const result = computeImpossibleSet(doc, {
    talentSelectionsByProfile: selections,
  });

  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries[0]?.reasonLabel).toBe("rank check");
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
      [getProfileScopeKey(doc.profiles[0])]: { "buff.hot_hand.up": false },
    },
  };
  const result = computeImpossibleSet(doc, { conditionOverrides: overrides });
  expect(result.hiddenCountByProfile.get(0)).toBe(1);
  expect(result.hiddenCountByProfile.has(1)).toBe(false);
});

test("same-name profiles can be overridden independently by scope key", () => {
  const doc = parseOrThrow(`
shaman="Same"
actions=lava_lash,if=buff.hot_hand.up

shaman="Same"
actions=stormstrike,if=buff.hot_hand.up
`);
  const overrides: ConditionOverrides = {
    global: {},
    byProfile: {
      [getProfileScopeKey(doc.profiles[1])]: { "buff.hot_hand.up": false },
    },
  };

  const result = computeImpossibleSet(doc, { conditionOverrides: overrides });

  expect(result.hiddenCountByProfile.has(0)).toBe(false);
  expect(result.hiddenCountByProfile.get(1)).toBe(1);
});

test("self cooldown remains condition hides the unavailable action without overrides", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=doom_winds,if=cooldown.doom_winds.remains>0
`);

  const result = computeImpossibleSet(doc);

  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual(["doom_winds"]);
  expect(summaries[0]?.reasonLabel).toBe("action unavailable");
});

test("negated self action ready hides the unavailable action", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=doom_winds,if=!action.doom_winds.ready
`);

  const result = computeImpossibleSet(doc);

  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual(["doom_winds"]);
  expect(summaries[0]?.reasonLabel).toBe("action unavailable");
});

test("self charge-zero condition hides charged cooldown action", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=doom_winds,if=cooldown.doom_winds.charges=0
`);

  const result = computeImpossibleSet(doc);

  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual(["doom_winds"]);
});

test("self charge greater-than-one stays possible because exact charge count is unknown", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=doom_winds,if=cooldown.doom_winds.charges>1
`);

  const result = computeImpossibleSet(doc);

  expect(result.actionIds.size).toBe(0);
  expect(result.hiddenCountByProfile.size).toBe(0);
});

test("metadata aliases shared cooldown names back to the current action", () => {
  const doc = parseOrThrow(`
shaman="Test"
spec=enhancement
actions=stormstrike,if=cooldown.strike.remains>0
`);

  const result = computeImpossibleSet(doc, {
    semanticCatalogsByProfile: new Map([
      [
        0,
        catalogFor({
          actions: ["stormstrike"],
          cooldowns: ["strike"],
        }),
      ],
    ]),
  });

  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual(["stormstrike"]);
  expect(summaries[0]?.reasonLabel).toBe("action unavailable");
});

test("shared cooldown aliases are ignored without matching metadata", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=stormstrike,if=cooldown.strike.remains>0
`);

  const result = computeImpossibleSet(doc);

  expect(result.actionIds.size).toBe(0);
  expect(result.hiddenCountByProfile.size).toBe(0);
});

test("other-action cooldown condition does not hide the current action", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=stormstrike,if=cooldown.doom_winds.remains>0
`);

  const result = computeImpossibleSet(doc);

  expect(result.actionIds.size).toBe(0);
  expect(result.hiddenCountByProfile.size).toBe(0);
});

test("self cooldown OR another branch stays possible", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=doom_winds,if=cooldown.doom_winds.remains>0|buff.ascendance.up
`);

  const result = computeImpossibleSet(doc);

  expect(result.actionIds.size).toBe(0);
  expect(result.hiddenCountByProfile.size).toBe(0);
});

test("self availability combines with overrides in mixed OR conditions", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=doom_winds,if=cooldown.doom_winds.remains>0|buff.ascendance.up
`);
  const overrides: ConditionOverrides = {
    ...EMPTY_CONDITION_OVERRIDES,
    global: { "buff.ascendance.up": false },
  };

  const result = computeImpossibleSet(doc, { conditionOverrides: overrides });

  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual(["doom_winds"]);
  expect(summaries[0]?.reasonLabel).toBe("action unavailable");
});

test("self availability combines with decoded talents in mixed OR conditions", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=doom_winds,if=cooldown.doom_winds.remains>0|talent.storm_unleashed.enabled
`);
  const selections = selectionsFor(0, {
    status: { kind: "decoded" },
    selections: { storm_unleashed: 0 },
  });

  const result = computeImpossibleSet(doc, {
    talentSelectionsByProfile: selections,
  });

  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual(["doom_winds"]);
  expect(summaries[0]?.reasonLabel).toBe("action unavailable");
});

test("self cooldown under AND hides the unavailable action", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=doom_winds,if=buff.ascendance.up&cooldown.doom_winds.remains>0
`);

  const result = computeImpossibleSet(doc);

  const summaries = result.hiddenActionsByProfile.get(0) ?? [];
  expect(summaries.map((summary) => summary.spell)).toEqual(["doom_winds"]);
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

