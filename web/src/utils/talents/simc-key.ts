/**
 * Convert a WoW talent display name (e.g. `"Lava Lash"`) into the SimC
 * condition key (`lava_lash`) that appears inside `talent.<key>` /
 * `talent.<key>.enabled` / `talent.<key>.rank` references in APL text.
 *
 * Matches SimC's `util::tokenize` closely enough for the talent corpus
 * (empirically verified against SimC's shipped APLs):
 *
 *   1. lowercase + normalise unicode, strip diacritics
 *   2. drop apostrophes (both ASCII `'` and curly `'`) without substitution,
 *      so `"Thorim's Invocation"` becomes `thorims_invocation` rather than
 *      `thorim_s_invocation`
 *   3. collapse every remaining non-alphanumeric run to a single `_`
 *   4. trim leading / trailing underscores
 *
 * Keeping this aligned with SimC matters: if the key drifts, the
 * evaluator simply doesn't find the talent in the selections map, and
 * every `talent.<key>` reference silently resolves to rank=0. The
 * runtime has no way to detect that.
 */
const APOSTROPHES = /[\u2019'\u2032]/g;
const NON_ALNUM = /[^a-z0-9]+/g;

export function simmifyTalentName(displayName: string): string {
  const lower = displayName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(APOSTROPHES, "");
  const tokenised = lower.replace(NON_ALNUM, "_");
  return trimUnderscores(tokenised);
}

function trimUnderscores(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "_") {
    start++;
  }
  while (end > start && value[end - 1] === "_") {
    end--;
  }
  return value.slice(start, end);
}

/**
 * Hand-maintained override map for talents where SimC's canonical key
 * does not fall out of `simmifyTalentName(displayName)` - typically
 * because the display name contains wording SimC historically shortened,
 * or because two talents would collide after tokenisation.
 *
 * Keep this map as small as possible: entries only land here when a real
 * APL author is seen to rely on a key that does not match the tokenised
 * form. Empty is the correct default when the game patch ships.
 */
export const SIMC_KEY_OVERRIDES: Readonly<Record<string, string>> = {};

export function resolveSimcKey(
  displayName: string,
  explicitKey?: string,
): string {
  if (explicitKey && explicitKey.length > 0) {
    return explicitKey;
  }
  const tokenised = simmifyTalentName(displayName);
  return SIMC_KEY_OVERRIDES[tokenised] ?? tokenised;
}
