import type { AplDocument } from "@/utils/apl-parser/document";
import { getProfileScopeKey } from "@/utils/apl-parser/profile-scope";
import {
  EMPTY_CONDITION_OVERRIDES,
  type AtomOverrides,
  type ConditionOverrides,
} from "./types";

const PROFILE_SCOPE_PREFIX = "profile:";

/**
 * Upgrade legacy profile override buckets from display-name keys to stable
 * scope keys for the currently parsed document.
 *
 * Legacy behavior applied `byProfile["Name"]` to every profile with that
 * display name. Preserve that user-visible behavior by fanning the old bucket
 * out to each matching profile scope, then dropping the legacy bucket.
 */
export function migrateConditionOverridesForDocument(
  overrides: ConditionOverrides,
  document: AplDocument | null,
): ConditionOverrides {
  if (!document || Object.keys(overrides.byProfile).length === 0) {
    return overrides;
  }

  const scopeKeys = new Set<string>();
  const scopeKeysByDisplayName = new Map<string, string[]>();
  for (const profile of document.profiles) {
    const scopeKey = getProfileScopeKey(profile);
    scopeKeys.add(scopeKey);
    const existing = scopeKeysByDisplayName.get(profile.name) ?? [];
    existing.push(scopeKey);
    scopeKeysByDisplayName.set(profile.name, existing);
  }

  let changed = false;
  const nextByProfile: Record<string, AtomOverrides> = {};

  for (const [key, atomOverrides] of Object.entries(overrides.byProfile)) {
    if (isProfileScopeKey(key) || scopeKeys.has(key)) {
      nextByProfile[key] = atomOverrides;
    }
  }

  for (const [key, atomOverrides] of Object.entries(overrides.byProfile)) {
    if (isProfileScopeKey(key) || scopeKeys.has(key)) {
      continue;
    }

    const targetScopeKeys = scopeKeysByDisplayName.get(key);
    if (!targetScopeKeys || targetScopeKeys.length === 0) {
      // Keep unrelated legacy buckets because this document cannot safely map
      // them. They may belong to another saved APL the user switches to later.
      nextByProfile[key] = atomOverrides;
      continue;
    }

    changed = true;
    for (const targetScopeKey of targetScopeKeys) {
      nextByProfile[targetScopeKey] = mergeAtomOverrides(
        atomOverrides,
        nextByProfile[targetScopeKey],
      );
    }
  }

  if (!changed) {
    return overrides;
  }

  return collapseEmpty({
    global: overrides.global,
    byProfile: nextByProfile,
  });
}

function isProfileScopeKey(key: string): boolean {
  return key.startsWith(PROFILE_SCOPE_PREFIX);
}

function mergeAtomOverrides(
  legacyOverrides: AtomOverrides,
  existingOverrides: AtomOverrides | undefined,
): AtomOverrides {
  return existingOverrides
    ? { ...legacyOverrides, ...existingOverrides }
    : legacyOverrides;
}

function collapseEmpty(overrides: ConditionOverrides): ConditionOverrides {
  if (
    Object.keys(overrides.global).length === 0 &&
    Object.keys(overrides.byProfile).length === 0
  ) {
    return EMPTY_CONDITION_OVERRIDES;
  }
  return overrides;
}
