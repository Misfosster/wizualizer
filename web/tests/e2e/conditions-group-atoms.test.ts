import { test, expect } from "@playwright/test";
import { parseDocument } from "../../src/utils/apl-parser/document";
import { extractConditionAtoms } from "../../src/utils/conditions/extract-atoms";
import {
  filterAtomsBySearch,
  groupAtoms,
} from "../../src/utils/conditions/group-atoms";

const DOC = `
shaman="Test"
spec=enhancement
actions=auto_attack
actions+=/lava_lash,if=buff.hot_hand.up
actions+=/stormstrike,if=cooldown.doom_winds.remains<2|buff.ascendance.up
actions+=/tempest,if=buff.ascendance.remains>5
actions+=/wait,if=fight_remains<10
`;

function atomsFor(text: string) {
  const result = parseDocument(text);
  if (!result.ok) {
    throw new Error(`Parse failed: ${result.error}`);
  }
  return extractConditionAtoms(result.document).all;
}

test("groupAtoms buckets atoms by namespace then subject, alphabetically", () => {
  const groups = groupAtoms(atomsFor(DOC));
  const namespaces = groups.map((group) => group.namespace);
  expect(namespaces).toEqual(["buff", "cooldown", "fight_remains"]);

  const buffSubjects = groups[0].subjects.map((subgroup) => subgroup.subject);
  expect(buffSubjects).toEqual(["ascendance", "hot_hand"]);
});

test("groupAtoms sorts atoms inside a subject by property", () => {
  const groups = groupAtoms(atomsFor(DOC));
  const ascendance = groups[0].subjects[0];
  expect(ascendance.atoms.map((atom) => atom.parts.property)).toEqual([
    "remains",
    "up",
  ]);
});

test("groupAtoms places single-segment names under an empty subject row", () => {
  const groups = groupAtoms(atomsFor(DOC));
  const fightRemains = groups[2];
  expect(fightRemains.namespace).toBe("fight_remains");
  expect(fightRemains.subjects.length).toBe(1);
  expect(fightRemains.subjects[0].subject).toBe("");
  expect(fightRemains.subjects[0].atoms.map((a) => a.key)).toEqual([
    "fight_remains",
  ]);
});

test("groupAtoms displays action cooldown atoms under cooldowns", () => {
  const groups = groupAtoms(
    atomsFor(`
shaman="Test"
spec=enhancement
actions=fireblood,if=action.fireblood.cooldown&action.fireblood.duration>0
`),
  );
  expect(groups).toHaveLength(1);
  expect(groups[0].namespace).toBe("cooldown");
  expect(groups[0].label).toBe("Cooldowns");
  expect(groups[0].subjects[0].subject).toBe("fireblood");
  expect(groups[0].subjects[0].atoms.map((atom) => atom.key)).toEqual([
    "action.fireblood.duration",
    "action.fireblood.cooldown",
  ]);
});

test("filterAtomsBySearch returns input untouched for empty queries", () => {
  const atoms = atomsFor(DOC);
  expect(filterAtomsBySearch(atoms, "")).toBe(atoms);
  expect(filterAtomsBySearch(atoms, "   ")).toBe(atoms);
});

test("filterAtomsBySearch matches case-insensitively on canonical keys", () => {
  const atoms = atomsFor(DOC);
  const matched = filterAtomsBySearch(atoms, "ASCENDANCE");
  expect(matched.map((atom) => atom.key)).toEqual([
    "buff.ascendance.remains",
    "buff.ascendance.up",
  ]);
});

test("filterAtomsBySearch returns empty when nothing matches", () => {
  const atoms = atomsFor(DOC);
  expect(filterAtomsBySearch(atoms, "nope")).toEqual([]);
});
