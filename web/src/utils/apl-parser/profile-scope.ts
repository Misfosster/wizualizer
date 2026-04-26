import type { AplProfile } from "./document";

export type ProfileScopeInput = Pick<
  AplProfile,
  "className" | "name" | "ordinalAmongSameNameSiblings"
>;

const UNKNOWN_CLASS = "unknown";
const UNTITLED_PROFILE = "Untitled";

/**
 * Stable, text-derived identity for profile-scoped editor state.
 *
 * Display names are not unique in SimC profiles, so internal maps must never
 * use `profile.name` directly. The ordinal is assigned while parsing by
 * counting previous profiles with the same class/name pair.
 */
export function getProfileScopeKey(profile: ProfileScopeInput): string {
  const className = profile.className || UNKNOWN_CLASS;
  const profileName = profile.name || UNTITLED_PROFILE;
  return [
    "profile",
    encodeURIComponent(className),
    encodeURIComponent(profileName),
    String(profile.ordinalAmongSameNameSiblings),
  ].join(":");
}
