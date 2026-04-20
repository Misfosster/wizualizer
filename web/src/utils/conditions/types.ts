/**
 * Condition-override types: the data model behind the "toggle any
 * condition on/off" panel.
 *
 * An *atom* is one leaf reference inside a SimC condition AST, e.g.
 * `buff.ascendance.up`, `cooldown.doom_winds.remains`, `variable.ll_reset`,
 * `talent.storm_unleashed.enabled`. Atoms are identified by their dotted
 * canonical key, which doubles as the storage key.
 *
 * Overrides are typed by atom: boolean atoms are tri-state
 * (true / false / absent), and numeric atoms store a finite number or
 * absent. Absent means "no opinion" - the evaluator falls back to its
 * default (decoded talents for `talent.*`, `unknown` for everything else).
 *
 * Two layers exist:
 *
 *   - `global`     - applies to every profile. Allowed to override
 *                    `talent.*` atoms (a what-if knob across the
 *                    whole document).
 *   - `byProfile`  - per-profile, keyed by profile name. Restricted to
 *                    non-talent atoms; talent state per profile comes
 *                    only from the import string.
 *
 * Resolution order is enforced by `resolve-atom.ts` rather than baked
 * into the data shape, so the structure stays a flat record that's
 * trivial to JSON-serialize for `localStorage`.
 */

export interface AtomParts {
  /** First dotted segment, e.g. `talent`, `buff`, `variable`. */
  namespace: string;
  /** Second segment when present (`storm_unleashed`, `ascendance`). */
  subject: string;
  /** Anything after the subject, joined by `.`. Empty for bare names. */
  property: string;
}

/** Canonical atom identifier - the source string itself, lower-cased. */
export type AtomKey = string;
export type ConditionAtomValueKind = "boolean" | "number";
export type NumericOverrideOperator = "=" | "<" | "<=" | ">" | ">=";

export interface NumericAtomOverride {
  kind: "comparison";
  op: NumericOverrideOperator;
  value: number;
}

export type AtomOverrideValue = boolean | number | NumericAtomOverride;

export interface ConditionAtom {
  key: AtomKey;
  parts: AtomParts;
  /** Convenience flag so the per-profile UI can render talents read-only. */
  isTalent: boolean;
  /** Which control and evaluator value shape this atom should use. */
  valueKind: ConditionAtomValueKind;
}

/** Missing key = unknown / default. */
export type AtomOverrides = Readonly<Record<AtomKey, AtomOverrideValue>>;

export interface ConditionOverrides {
  global: AtomOverrides;
  /** Per-profile overrides keyed by `AplProfile.name`. */
  byProfile: Readonly<Record<string, AtomOverrides>>;
}

export const EMPTY_ATOM_OVERRIDES: AtomOverrides = Object.freeze({});

export const EMPTY_CONDITION_OVERRIDES: ConditionOverrides = Object.freeze({
  global: EMPTY_ATOM_OVERRIDES,
  byProfile: Object.freeze({}),
});
