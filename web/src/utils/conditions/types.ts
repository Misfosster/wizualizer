/**
 * Condition-override types: the data model behind the "toggle any
 * condition on/off" panel.
 *
 * An *atom* is one leaf reference inside a SimC condition AST, e.g.
 * `buff.ascendance.up`, `cooldown.doom_winds.remains`, `variable.ll_reset`,
 * `talent.storm_unleashed.enabled`. Atoms are identified by their dotted
 * canonical key, which doubles as the storage key.
 *
 * Overrides are tri-state (true / false / absent). Absent means "no
 * opinion" - the evaluator falls back to its default (decoded talents
 * for `talent.*`, `unknown` for everything else).
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

export interface ConditionAtom {
  key: AtomKey;
  parts: AtomParts;
  /** Convenience flag so the per-profile UI can render talents read-only. */
  isTalent: boolean;
}

/** Tri-state encoded by presence: missing key = unknown / default. */
export type AtomOverrides = Readonly<Record<AtomKey, boolean>>;

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
