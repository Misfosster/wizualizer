import { test, expect } from "@playwright/test";
import { parseDocument } from "../../src/utils/apl-parser/document";
import { getProfileScopeKey } from "../../src/utils/apl-parser/profile-scope";
import { extractConditionAtoms } from "../../src/utils/conditions/extract-atoms";

const SHAMAN_DOC = `
shaman="Test"
spec=enhancement
talents=ABC
actions=auto_attack
actions+=/lava_lash,if=buff.hot_hand.up&talent.lashing_flames.enabled
actions+=/stormstrike,if=cooldown.doom_winds.remains<2|buff.ascendance.up
actions+=/wait,sec=1
`;

const TWO_PROFILE_DOC = `
shaman="One"
spec=enhancement
actions=lava_lash,if=buff.hot_hand.up

mage="Two"
spec=fire
actions=fireball,if=buff.combustion.up
`;

function parseOrThrow(text: string) {
  const result = parseDocument(text);
  if (!result.ok) {
    throw new Error(`Parse failed: ${result.error}`);
  }
  return result.document;
}

test("extractConditionAtoms collects every leaf atom across actions", () => {
  const doc = parseOrThrow(SHAMAN_DOC);
  const atoms = extractConditionAtoms(doc);
  const keys = atoms.all.map((a) => a.key);
  expect(keys).toEqual([
    "buff.ascendance.up",
    "buff.hot_hand.up",
    "cooldown.doom_winds.remains",
    "talent.lashing_flames.enabled",
  ]);
});

test("extractConditionAtoms tags talent atoms via isTalent", () => {
  const doc = parseOrThrow(SHAMAN_DOC);
  const atoms = extractConditionAtoms(doc);
  for (const atom of atoms.all) {
    expect(atom.isTalent).toBe(atom.key.startsWith("talent."));
  }
});

test("extractConditionAtoms identifies boolean and numeric atoms", () => {
  const doc = parseOrThrow(SHAMAN_DOC);
  const atoms = extractConditionAtoms(doc);
  const byKey = new Map(atoms.all.map((atom) => [atom.key, atom]));
  expect(byKey.get("buff.hot_hand.up")?.valueKind).toBe("boolean");
  expect(byKey.get("talent.lashing_flames.enabled")?.valueKind).toBe(
    "boolean",
  );
  expect(byKey.get("cooldown.doom_winds.remains")?.valueKind).toBe("number");
});

test("extractConditionAtoms treats bare active_enemies as numeric", () => {
  const doc = parseOrThrow(`
shaman="Test"
spec=enhancement
actions=stormstrike,if=active_enemies
`);
  const atoms = extractConditionAtoms(doc);
  const byKey = new Map(atoms.all.map((atom) => [atom.key, atom]));
  expect(byKey.get("active_enemies")?.valueKind).toBe("number");
});

test("extractConditionAtoms treats bare action cooldown checks as boolean", () => {
  const doc = parseOrThrow(`
shaman="Test"
spec=enhancement
actions=fireblood,if=action.fireblood.cooldown
actions+=/berserking,if=action.berserking.cooldown>0
`);
  const atoms = extractConditionAtoms(doc);
  const byKey = new Map(atoms.all.map((atom) => [atom.key, atom]));
  expect(byKey.get("action.fireblood.cooldown")?.valueKind).toBe("boolean");
  expect(byKey.get("action.berserking.cooldown")?.valueKind).toBe("number");
});

test("extractConditionAtoms ignores numeric literals and segment kinds besides if/target_if", () => {
  const doc = parseOrThrow(SHAMAN_DOC);
  const atoms = extractConditionAtoms(doc);
  expect(atoms.all.some((a) => a.key === "sec")).toBe(false);
});

test("extractConditionAtoms ignores ranking target_if expressions", () => {
  const doc = parseOrThrow(`
shaman="Test"
actions=auto_attack,target_if=max:target.time_to_die
actions+=/lava_lash,target_if=min:talent.foo
actions+=/stormstrike,target_if=first:talent.bar
`);
  const atoms = extractConditionAtoms(doc);
  expect(atoms.all.map((a) => a.key)).toEqual(["talent.bar"]);
});

test("extractConditionAtoms partitions atoms per profile scope key", () => {
  const doc = parseOrThrow(TWO_PROFILE_DOC);
  const atoms = extractConditionAtoms(doc);
  const oneKeys =
    atoms.byProfile.get(getProfileScopeKey(doc.profiles[0]))?.map((a) => a.key) ??
    [];
  const twoKeys =
    atoms.byProfile.get(getProfileScopeKey(doc.profiles[1]))?.map((a) => a.key) ??
    [];
  expect(oneKeys).toEqual(["buff.hot_hand.up"]);
  expect(twoKeys).toEqual(["buff.combustion.up"]);
});

test("extractConditionAtoms reports atoms shared by every profile", () => {
  const doc = parseOrThrow(`
shaman="Enhance"
actions=stormstrike,if=cooldown.doom_winds.remains>0&fight_remains<30

monk="Windwalker"
actions=tiger_palm,if=energy>50&fight_remains<30
`);
  const atoms = extractConditionAtoms(doc);

  expect(atoms.all.map((a) => a.key)).toEqual([
    "cooldown.doom_winds.remains",
    "energy",
    "fight_remains",
  ]);
  expect(atoms.shared.map((a) => a.key)).toEqual(["fight_remains"]);
});

test("extractConditionAtoms promotes shared atoms using document-wide usage", () => {
  const doc = parseOrThrow(`
shaman="One"
actions=fireblood,if=action.fireblood.cooldown

shaman="Two"
actions=fireblood,if=action.fireblood.cooldown>0
`);
  const atoms = extractConditionAtoms(doc);
  const fireblood = atoms.shared.find(
    (atom) => atom.key === "action.fireblood.cooldown",
  );

  expect(fireblood?.valueKind).toBe("number");
});

test("extractConditionAtoms uses one bucket per duplicate profile scope key", () => {
  const doc = parseOrThrow(`
shaman="Same"
actions=lava_lash,if=buff.hot_hand.up

shaman="Same"
actions=stormstrike,if=buff.ascendance.up
`);
  const atoms = extractConditionAtoms(doc);
  const firstScopeKey = getProfileScopeKey(doc.profiles[0]);
  const secondScopeKey = getProfileScopeKey(doc.profiles[1]);

  expect(firstScopeKey).not.toBe(secondScopeKey);
  expect(atoms.byProfile.get(firstScopeKey)?.map((a) => a.key)).toEqual([
    "buff.hot_hand.up",
  ]);
  expect(atoms.byProfile.get(secondScopeKey)?.map((a) => a.key)).toEqual([
    "buff.ascendance.up",
  ]);
});
