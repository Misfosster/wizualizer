import type { AplDocument } from "@/utils/apl-parser/document";
import type { Condition } from "@/utils/apl-parser/types";
import {
  canonicalAtomKey,
  isTalentAtomKey,
  parseAtomKey,
} from "./atom-key";
import type { ConditionAtom } from "./types";

/**
 * Walk a parsed APL document and collect every distinct atomic
 * reference that appears inside an `if=` or `target_if=` condition.
 * The result is what the override panel binds to: each atom can be
 * toggled on / off / default, and the evaluator looks them up by key.
 *
 * Sequence segments do not contribute atoms because they are filter
 * keys, not boolean expressions, and toggling them would not affect
 * eligibility under the current parser.
 *
 * Output is intentionally split:
 *   - `all`         - deduped atoms across the whole document, used by
 *                     the global panel.
 *   - `byProfile`   - deduped atoms per profile, used by the per-
 *                     profile expander so each row only lists atoms
 *                     that profile actually references.
 *
 * Both lists are sorted by key for stable rendering and stable test
 * snapshots; the UI re-sorts into a tree separately.
 */
export interface ExtractedConditionAtoms {
  all: readonly ConditionAtom[];
  byProfile: ReadonlyMap<string, readonly ConditionAtom[]>;
}

const EMPTY_ATOMS: readonly ConditionAtom[] = [];

export function extractConditionAtoms(
  document: AplDocument,
): ExtractedConditionAtoms {
  const all = new Map<string, ConditionAtom>();
  const byProfile = new Map<string, Map<string, ConditionAtom>>();

  for (const profile of document.profiles) {
    const profileAtoms = new Map<string, ConditionAtom>();
    byProfile.set(profile.name, profileAtoms);

    for (const block of profile.blocks) {
      for (const actionLine of block.actions) {
        for (const segment of actionLine.action.segments) {
          if (segment.type !== "if" && segment.type !== "target_if") {
            continue;
          }
          collectAtoms(segment.expr, all, profileAtoms);
        }
      }
    }
  }

  return {
    all: sortAtoms(Array.from(all.values())),
    byProfile: freezeByProfile(byProfile),
  };
}

function collectAtoms(
  condition: Condition,
  all: Map<string, ConditionAtom>,
  profileAtoms: Map<string, ConditionAtom>,
): void {
  switch (condition.kind) {
    case "ident":
      registerAtom(condition.name, all, profileAtoms);
      return;
    case "number":
      return;
    case "paren":
      collectAtoms(condition.expr, all, profileAtoms);
      return;
    case "unary":
      collectAtoms(condition.expr, all, profileAtoms);
      return;
    case "binary":
      collectAtoms(condition.left, all, profileAtoms);
      collectAtoms(condition.right, all, profileAtoms);
      return;
    case "call":
      for (const arg of condition.args) {
        collectAtoms(arg, all, profileAtoms);
      }
      return;
    case "sequence":
      // Sequence ident lists are filter keys, not atoms used in 3-valued
      // boolean evaluation; toggling them would not change eligibility.
      return;
  }
}

function registerAtom(
  rawName: string,
  all: Map<string, ConditionAtom>,
  profileAtoms: Map<string, ConditionAtom>,
): void {
  const key = canonicalAtomKey(rawName);
  if (key.length === 0) {
    return;
  }

  let atom = all.get(key);
  if (!atom) {
    atom = {
      key,
      parts: parseAtomKey(key),
      isTalent: isTalentAtomKey(key),
    };
    all.set(key, atom);
  }

  profileAtoms.set(key, atom);
}

function sortAtoms(atoms: ConditionAtom[]): readonly ConditionAtom[] {
  return atoms.sort((a, b) => a.key.localeCompare(b.key));
}

function freezeByProfile(
  byProfile: Map<string, Map<string, ConditionAtom>>,
): ReadonlyMap<string, readonly ConditionAtom[]> {
  const result = new Map<string, readonly ConditionAtom[]>();
  for (const [name, atoms] of byProfile) {
    result.set(
      name,
      atoms.size === 0
        ? EMPTY_ATOMS
        : sortAtoms(Array.from(atoms.values())),
    );
  }
  return result;
}
