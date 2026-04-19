import type { AtomParts } from "./types";

/**
 * Pure helpers for the canonical atom-key format used by the condition
 * overrides system. The key is just the dotted SimC identifier, lower-
 * cased and trimmed, used both as a `Record` key and as the storage
 * identifier in `localStorage`.
 *
 * Splitting an identifier:
 *   `talent.storm_unleashed`           -> { namespace: "talent",  subject: "storm_unleashed",     property: "" }
 *   `talent.storm_unleashed.enabled`   -> { namespace: "talent",  subject: "storm_unleashed",     property: "enabled" }
 *   `buff.ascendance.up`               -> { namespace: "buff",    subject: "ascendance",          property: "up" }
 *   `trinket.1.is.algethar_puzzle_box` -> { namespace: "trinket", subject: "1",                   property: "is.algethar_puzzle_box" }
 *   `fight_remains`                    -> { namespace: "fight_remains", subject: "", property: "" }
 *
 * Single-segment identifiers (no dots) are still atoms; the panel
 * renders them under a "(global)" subject row so they have a place in
 * the tree without inventing a fake namespace.
 */

const TRIM = /\s+/g;

export function canonicalAtomKey(name: string): string {
  return name.replace(TRIM, "").toLowerCase();
}

export function parseAtomKey(key: string): AtomParts {
  const segments = key.split(".");
  const namespace = segments[0] ?? "";
  const subject = segments[1] ?? "";
  const property = segments.length > 2 ? segments.slice(2).join(".") : "";
  return { namespace, subject, property };
}

export function isTalentAtomKey(key: string): boolean {
  return key === "talent" || key.startsWith("talent.");
}

/**
 * The simc key embedded inside a `talent.*` atom (e.g. `talent.storm_unleashed.enabled`
 * yields `storm_unleashed`). Returns `null` for non-talent atoms or
 * malformed talent keys with no subject. Used by the resolver and by
 * the read-only "decoded rank" line in the per-profile panel.
 */
export function talentSimcKey(key: string): string | null {
  if (!isTalentAtomKey(key)) {
    return null;
  }
  const parts = parseAtomKey(key);
  return parts.subject || null;
}
