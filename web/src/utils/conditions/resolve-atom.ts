import type { IdentRef } from "@/utils/apl-parser/types";
import {
  UNKNOWN_VALUE,
  boolValue,
  numberValue,
  type EvalValue,
} from "@/utils/talents/types";
import { canonicalAtomKey, parseAtomKey } from "./atom-key";
import type { AtomOverrides } from "./types";

/**
 * Resolve a single condition atom to a concrete `EvalValue` using the
 * layered lookup defined for the override system:
 *
 *   talent.* atoms ->  global override (if set)
 *                  ->  decoded rank from `talents=` (if available)
 *                  ->  unknown
 *
 *   anything else  ->  profile override (if set)
 *                  ->  global override (if set)
 *                  ->  unknown
 *
 * Booleans returned by overrides are projected into the same shape the
 * evaluator already understands (`bool` for presence/enabled/non-talent,
 * `number` for `talent.<key>.rank`), so the rest of the evaluator does
 * not need to care which layer produced the value.
 */
export interface ProfileResolutionContext {
  /** Decoded `simcKey -> rank` map for this profile, or empty. */
  selections: Readonly<Record<string, number>>;
  /**
   * Whether `selections` represents a successful decode. When `false`,
   * a missing key means "we don't know what was picked" (stay
   * `unknown`) rather than "rank is zero" - overrides are the only
   * way to assert truth about `talent.*` atoms in that state.
   * Defaults to `true` so the legacy decoded-only callers are
   * unchanged.
   */
  selectionsTrusted?: boolean;
  /** Document-wide overrides; allowed to override talents. */
  globalOverrides: AtomOverrides;
  /** Per-profile overrides; only consulted for non-talent atoms. */
  profileOverrides: AtomOverrides;
}

export function resolveAtom(
  ident: IdentRef,
  context: ProfileResolutionContext,
): EvalValue {
  const key = canonicalAtomKey(ident.name);
  if (key.length === 0) {
    return UNKNOWN_VALUE;
  }

  const parts = parseAtomKey(key);
  if (parts.namespace === "talent") {
    return resolveTalentAtom(key, parts.subject, parts.property, context);
  }

  return resolveNonTalentAtom(key, context);
}

function resolveTalentAtom(
  key: string,
  subject: string,
  property: string,
  context: ProfileResolutionContext,
): EvalValue {
  const override = context.globalOverrides[key];
  if (typeof override === "boolean") {
    if (property === "rank") {
      // A boolean override on a rank atom maps to 0 / 1 so comparisons
      // (`talent.foo.rank>=2`) still produce a definite truth value.
      return numberValue(override ? 1 : 0);
    }
    return boolValue(override);
  }

  if (subject.length === 0) {
    return UNKNOWN_VALUE;
  }

  const trusted = context.selectionsTrusted !== false;
  if (!trusted && !(subject in context.selections)) {
    return UNKNOWN_VALUE;
  }

  const rank = context.selections[subject] ?? 0;
  if (property === "rank") {
    return numberValue(rank);
  }
  if (property === "" || property === "enabled") {
    return boolValue(rank > 0);
  }

  // Unknown talent.* sub-namespace - leave as unknown rather than make
  // up a value, matching the legacy evaluator's defensive behaviour.
  return UNKNOWN_VALUE;
}

function resolveNonTalentAtom(
  key: string,
  context: ProfileResolutionContext,
): EvalValue {
  const profileOverride = context.profileOverrides[key];
  if (typeof profileOverride === "boolean") {
    return boolValue(profileOverride);
  }
  const globalOverride = context.globalOverrides[key];
  if (typeof globalOverride === "boolean") {
    return boolValue(globalOverride);
  }
  return UNKNOWN_VALUE;
}
