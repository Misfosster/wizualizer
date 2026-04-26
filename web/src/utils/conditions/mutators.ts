import {
  EMPTY_ATOM_OVERRIDES,
  EMPTY_CONDITION_OVERRIDES,
  type AtomOverrides,
  type AtomOverrideValue,
  type ConditionOverrides,
} from "./types";

/**
 * Pure helpers that produce a new `ConditionOverrides` from an old one
 * given a single edit. The store calls these and hands the result back
 * to `setConditionOverrides`, which persists + rebuilds the graph.
 *
 * Keeping mutation out of the store action body lets the same helpers
 * back the future per-profile UI and unit tests, and lets us reason
 * about edits without cloning the entire object literal at the call
 * site.
 *
 * Scope is a tagged union so call sites can switch between the two
 * panels with a single field, and so future scopes (e.g. a
 * "profile-set" override) can extend the union without breaking the
 * existing API.
 */

export type OverrideScope = "global" | { profile: string };

export function getOverrideValue(
  overrides: ConditionOverrides,
  scope: OverrideScope,
  key: string,
): AtomOverrideValue | undefined {
  return readScope(overrides, scope)[key];
}

export function setOverride(
  overrides: ConditionOverrides,
  scope: OverrideScope,
  key: string,
  value: AtomOverrideValue,
): ConditionOverrides {
  const current = readScope(overrides, scope);
  if (isSameOverrideValue(current[key], value)) {
    return overrides;
  }
  return writeScope(overrides, scope, { ...current, [key]: value });
}

export function clearOverride(
  overrides: ConditionOverrides,
  scope: OverrideScope,
  key: string,
): ConditionOverrides {
  const current = readScope(overrides, scope);
  if (!(key in current)) {
    return overrides;
  }
  const next = omitRecordKey(current, key);
  return writeScope(overrides, scope, next);
}

/**
 * Drop every override in the given scope. `clearScope("global")`
 * powers the panel's "Reset all" affordance; `clearScope({profile})`
 * is the per-profile equivalent.
 */
export function clearScope(
  overrides: ConditionOverrides,
  scope: OverrideScope,
): ConditionOverrides {
  if (scope === "global") {
    if (Object.keys(overrides.global).length === 0) {
      return overrides;
    }
    const next: ConditionOverrides = {
      global: EMPTY_ATOM_OVERRIDES,
      byProfile: overrides.byProfile,
    };
    return collapseEmpty(next);
  }
  const profileScopeKey = scope.profile;
  if (!(profileScopeKey in overrides.byProfile)) {
    return overrides;
  }
  const nextByProfile = omitRecordKey(overrides.byProfile, profileScopeKey);
  return collapseEmpty({
    global: overrides.global,
    byProfile: nextByProfile,
  });
}

export function countOverrides(
  overrides: ConditionOverrides,
  scope: OverrideScope,
): number {
  return Object.keys(readScope(overrides, scope)).length;
}

function readScope(
  overrides: ConditionOverrides,
  scope: OverrideScope,
): AtomOverrides {
  if (scope === "global") {
    return overrides.global;
  }
  return overrides.byProfile[scope.profile] ?? EMPTY_ATOM_OVERRIDES;
}

function writeScope(
  overrides: ConditionOverrides,
  scope: OverrideScope,
  next: AtomOverrides,
): ConditionOverrides {
  if (scope === "global") {
    return collapseEmpty({
      global: next,
      byProfile: overrides.byProfile,
    });
  }
  const profileScopeKey = scope.profile;
  const nextByProfile: Record<string, AtomOverrides> = { ...overrides.byProfile };
  if (Object.keys(next).length === 0) {
    return collapseEmpty({
      global: overrides.global,
      byProfile: omitRecordKey(nextByProfile, profileScopeKey),
    });
  } else {
    nextByProfile[profileScopeKey] = next;
  }
  return collapseEmpty({
    global: overrides.global,
    byProfile: nextByProfile,
  });
}

function omitRecordKey<T>(
  record: Readonly<Record<string, T>>,
  keyToOmit: string,
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key !== keyToOmit) {
      next[key] = value;
    }
  }
  return next;
}

/**
 * Reduce an entirely empty result to the shared singleton so referential
 * equality checks (e.g. "did anything change?") in the store stay cheap
 * and JSON serialization writes nothing to localStorage.
 */
function collapseEmpty(overrides: ConditionOverrides): ConditionOverrides {
  if (
    Object.keys(overrides.global).length === 0 &&
    Object.keys(overrides.byProfile).length === 0
  ) {
    return EMPTY_CONDITION_OVERRIDES;
  }
  return overrides;
}

function isSameOverrideValue(
  left: AtomOverrideValue | undefined,
  right: AtomOverrideValue,
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || typeof left !== "object" || typeof right !== "object") {
    return false;
  }
  return left.op === right.op && left.value === right.value;
}
