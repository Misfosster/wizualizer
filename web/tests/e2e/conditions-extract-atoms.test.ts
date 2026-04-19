import { test, expect } from "@playwright/test";
import { parseDocument } from "../../src/utils/apl-parser/document";
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

test("extractConditionAtoms ignores numeric literals and segment kinds besides if/target_if", () => {
  const doc = parseOrThrow(SHAMAN_DOC);
  const atoms = extractConditionAtoms(doc);
  expect(atoms.all.some((a) => a.key === "sec")).toBe(false);
});

test("extractConditionAtoms partitions atoms per profile name", () => {
  const doc = parseOrThrow(TWO_PROFILE_DOC);
  const atoms = extractConditionAtoms(doc);
  const oneKeys = atoms.byProfile.get("One")?.map((a) => a.key) ?? [];
  const twoKeys = atoms.byProfile.get("Two")?.map((a) => a.key) ?? [];
  expect(oneKeys).toEqual(["buff.hot_hand.up"]);
  expect(twoKeys).toEqual(["buff.combustion.up"]);
});
