/**
 * Static mapping between the numeric IDs SimC emits into
 * `trait_data.inc` and the human-readable names we use on disk and at
 * runtime.
 *
 * These IDs come straight from Blizzard's client data (they're the same
 * values `specialization.hpp` exposes in SimC) and are stable across
 * game patches. Keeping the map hand-written instead of parsed from
 * SimC's `specialization.hpp` lets the generator work against any SimC
 * commit without forking a second parser.
 *
 * If a future class or spec ID is added upstream, extend these tables
 * and re-run `generate:talents`. The generator prints a warning (never
 * a hard error) when it encounters an unknown id.
 */

export interface ClassRegistryEntry {
  id: number;
  slug: string;
  displayName: string;
}

export interface SpecRegistryEntry {
  id: number;
  classSlug: string;
  slug: string;
  displayName: string;
}

export const CLASS_TABLE: readonly ClassRegistryEntry[] = [
  { id: 1, slug: "warrior", displayName: "Warrior" },
  { id: 2, slug: "paladin", displayName: "Paladin" },
  { id: 3, slug: "hunter", displayName: "Hunter" },
  { id: 4, slug: "rogue", displayName: "Rogue" },
  { id: 5, slug: "priest", displayName: "Priest" },
  { id: 6, slug: "death_knight", displayName: "Death Knight" },
  { id: 7, slug: "shaman", displayName: "Shaman" },
  { id: 8, slug: "mage", displayName: "Mage" },
  { id: 9, slug: "warlock", displayName: "Warlock" },
  { id: 10, slug: "monk", displayName: "Monk" },
  { id: 11, slug: "druid", displayName: "Druid" },
  { id: 12, slug: "demon_hunter", displayName: "Demon Hunter" },
  { id: 13, slug: "evoker", displayName: "Evoker" },
];

export const SPEC_TABLE: readonly SpecRegistryEntry[] = [
  { id: 71, classSlug: "warrior", slug: "arms", displayName: "Arms" },
  { id: 72, classSlug: "warrior", slug: "fury", displayName: "Fury" },
  { id: 73, classSlug: "warrior", slug: "protection", displayName: "Protection" },
  { id: 65, classSlug: "paladin", slug: "holy", displayName: "Holy" },
  { id: 66, classSlug: "paladin", slug: "protection", displayName: "Protection" },
  { id: 70, classSlug: "paladin", slug: "retribution", displayName: "Retribution" },
  { id: 253, classSlug: "hunter", slug: "beast_mastery", displayName: "Beast Mastery" },
  { id: 254, classSlug: "hunter", slug: "marksmanship", displayName: "Marksmanship" },
  { id: 255, classSlug: "hunter", slug: "survival", displayName: "Survival" },
  { id: 259, classSlug: "rogue", slug: "assassination", displayName: "Assassination" },
  { id: 260, classSlug: "rogue", slug: "outlaw", displayName: "Outlaw" },
  { id: 261, classSlug: "rogue", slug: "subtlety", displayName: "Subtlety" },
  { id: 256, classSlug: "priest", slug: "discipline", displayName: "Discipline" },
  { id: 257, classSlug: "priest", slug: "holy", displayName: "Holy" },
  { id: 258, classSlug: "priest", slug: "shadow", displayName: "Shadow" },
  { id: 250, classSlug: "death_knight", slug: "blood", displayName: "Blood" },
  { id: 251, classSlug: "death_knight", slug: "frost", displayName: "Frost" },
  { id: 252, classSlug: "death_knight", slug: "unholy", displayName: "Unholy" },
  { id: 262, classSlug: "shaman", slug: "elemental", displayName: "Elemental" },
  { id: 263, classSlug: "shaman", slug: "enhancement", displayName: "Enhancement" },
  { id: 264, classSlug: "shaman", slug: "restoration", displayName: "Restoration" },
  { id: 62, classSlug: "mage", slug: "arcane", displayName: "Arcane" },
  { id: 63, classSlug: "mage", slug: "fire", displayName: "Fire" },
  { id: 64, classSlug: "mage", slug: "frost", displayName: "Frost" },
  { id: 265, classSlug: "warlock", slug: "affliction", displayName: "Affliction" },
  { id: 266, classSlug: "warlock", slug: "demonology", displayName: "Demonology" },
  { id: 267, classSlug: "warlock", slug: "destruction", displayName: "Destruction" },
  { id: 268, classSlug: "monk", slug: "brewmaster", displayName: "Brewmaster" },
  { id: 269, classSlug: "monk", slug: "windwalker", displayName: "Windwalker" },
  { id: 270, classSlug: "monk", slug: "mistweaver", displayName: "Mistweaver" },
  { id: 102, classSlug: "druid", slug: "balance", displayName: "Balance" },
  { id: 103, classSlug: "druid", slug: "feral", displayName: "Feral" },
  { id: 104, classSlug: "druid", slug: "guardian", displayName: "Guardian" },
  { id: 105, classSlug: "druid", slug: "restoration", displayName: "Restoration" },
  { id: 577, classSlug: "demon_hunter", slug: "havoc", displayName: "Havoc" },
  { id: 581, classSlug: "demon_hunter", slug: "vengeance", displayName: "Vengeance" },
  { id: 1467, classSlug: "evoker", slug: "devastation", displayName: "Devastation" },
  { id: 1468, classSlug: "evoker", slug: "preservation", displayName: "Preservation" },
  { id: 1473, classSlug: "evoker", slug: "augmentation", displayName: "Augmentation" },
];

const CLASS_BY_ID: ReadonlyMap<number, ClassRegistryEntry> = new Map(
  CLASS_TABLE.map((entry) => [entry.id, entry]),
);
const SPEC_BY_ID: ReadonlyMap<number, SpecRegistryEntry> = new Map(
  SPEC_TABLE.map((entry) => [entry.id, entry]),
);

export function findClassById(id: number): ClassRegistryEntry | undefined {
  return CLASS_BY_ID.get(id);
}

export function findSpecById(id: number): SpecRegistryEntry | undefined {
  return SPEC_BY_ID.get(id);
}

export function specsForClass(classSlug: string): readonly SpecRegistryEntry[] {
  return SPEC_TABLE.filter((spec) => spec.classSlug === classSlug);
}
