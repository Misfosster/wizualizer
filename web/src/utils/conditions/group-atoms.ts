import type { ConditionAtom } from "./types";
import {
  getAtomDisplayParts,
  getAtomRowLabel,
  getAtomSearchText,
} from "./atom-display";

/**
 * Pure helpers that turn a flat list of `ConditionAtom`s into the
 * tree shape the override panel renders, plus a search-filter helper
 * scoped to the same shape.
 *
 * Tree rules:
 *   - Top level groups by `namespace` (`buff`, `cooldown`, `talent`,
 *     `variable`, `fight_remains`, ...).
 *   - Each namespace contains one or more "subjects" - the second
 *     dotted segment when present. Atoms with no subject (single-
 *     segment names like `fight_remains`) collapse under an empty
 *     `subject: ""` row so they still render somewhere obvious.
 *   - Subjects sort alphabetically; atoms inside a subject sort by
 *     their `property` then `key` so multi-segment properties stay
 *     adjacent (e.g. `trinket.1.is.algethar_puzzle_box` lives next
 *     to `trinket.1.is.unyielding_netherprism`).
 *
 * Search rules:
 *   - Substring match on the canonical key, case-insensitive,
 *     whitespace-trimmed - matching the user's mental model of "I
 *     just type a fragment".
 *   - An empty query returns the input list unchanged so callers
 *     do not have to special-case it.
 */

export interface AtomSubgroup {
  subject: string;
  atoms: readonly ConditionAtom[];
}

export interface AtomGroup {
  namespace: string;
  label: string;
  subjects: readonly AtomSubgroup[];
}

export function groupAtoms(
  atoms: readonly ConditionAtom[],
): readonly AtomGroup[] {
  const byNamespace = new Map<string, Map<string, ConditionAtom[]>>();

  for (const atom of atoms) {
    const display = getAtomDisplayParts(atom);
    const namespaceBucket = ensureNamespaceBucket(byNamespace, display.namespace);
    const subjectBucket = ensureSubjectBucket(namespaceBucket, display.subject);
    subjectBucket.push(atom);
  }

  const groups: AtomGroup[] = [];
  for (const namespace of sortKeys(byNamespace)) {
    const namespaceBucket = byNamespace.get(namespace);
    if (!namespaceBucket) continue;
    const subjects: AtomSubgroup[] = [];
    for (const subject of sortKeys(namespaceBucket)) {
      const atomsInSubject = namespaceBucket.get(subject);
      if (!atomsInSubject) continue;
      subjects.push({
        subject,
        atoms: atomsInSubject.slice().sort(compareAtomsByProperty),
      });
    }
    groups.push({
      namespace,
      label: getNamespaceLabel(subjects[0]?.atoms[0], namespace),
      subjects,
    });
  }
  return groups;
}

export function filterAtomsBySearch(
  atoms: readonly ConditionAtom[],
  query: string,
): readonly ConditionAtom[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return atoms;
  }
  return atoms.filter((atom) => getAtomSearchText(atom).includes(needle));
}

function ensureNamespaceBucket(
  byNamespace: Map<string, Map<string, ConditionAtom[]>>,
  namespace: string,
): Map<string, ConditionAtom[]> {
  let bucket = byNamespace.get(namespace);
  if (!bucket) {
    bucket = new Map<string, ConditionAtom[]>();
    byNamespace.set(namespace, bucket);
  }
  return bucket;
}

function ensureSubjectBucket(
  namespaceBucket: Map<string, ConditionAtom[]>,
  subject: string,
): ConditionAtom[] {
  let bucket = namespaceBucket.get(subject);
  if (!bucket) {
    bucket = [];
    namespaceBucket.set(subject, bucket);
  }
  return bucket;
}

function sortKeys<V>(map: Map<string, V>): string[] {
  return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
}

function compareAtomsByProperty(a: ConditionAtom, b: ConditionAtom): number {
  const propertyOrder = getAtomRowLabel(a).localeCompare(getAtomRowLabel(b));
  if (propertyOrder !== 0) {
    return propertyOrder;
  }
  return a.key.localeCompare(b.key);
}

function getNamespaceLabel(
  representative: ConditionAtom | undefined,
  namespace: string,
): string {
  if (!representative) {
    return namespace;
  }
  return getAtomDisplayParts(representative).namespaceLabel;
}
