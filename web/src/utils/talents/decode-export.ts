import type { AplDocument, AplProfile } from "@/utils/apl-parser/document";
import type { CatalogLoader, CatalogLookupResult } from "./catalog-loader";
import type { TalentSelectionResult } from "./types";

/**
 * Decode a single profile's `talents=` export string into selected talent
 * ranks keyed by SimC talent key.
 *
 * Current scope: the catalog generator and per-class JSON files are in
 * place, and the runtime catalog loader is wired through the editor
 * store, but the bit-level export-string decoder itself is still
 * pending. Each branch therefore returns a *specific* status so the UI
 * panel can tell the user exactly where we are:
 *
 *   - `absent`:            no `talents=` line on the profile
 *   - `loading`:           class catalog is being fetched
 *   - `missing_catalog`:   class is unknown to us (no JSON committed)
 *   - `unsupported_spec`:  class catalog exists but the spec slug is
 *                          not in `byClassSpec`
 *   - `decoder_pending`:   catalog + spec resolved; the bitstream
 *                          decoder is the next Phase D task
 *
 * Every branch returns an empty `selections` map, and only `decoded`
 * passes the filter's trust gate, so the graph is never filtered on
 * partial information.
 *
 * Replacing the `decoder_pending` branch is the single change the next
 * phase needs to make: given a loaded `TalentSpecCatalog`, read the
 * bit-packed export string, write ranks into `selections`, and return
 * `{ kind: "decoded" }` / `version_mismatch` / `malformed_export`.
 */
export function decodeProfileTalents(
  profile: AplProfile,
  lookup: CatalogLookupResult,
): TalentSelectionResult {
  if (!profile.talentExport) {
    return { status: { kind: "absent" }, selections: {} };
  }

  if (lookup.status === "loading") {
    return { status: { kind: "loading" }, selections: {} };
  }

  if (lookup.status === "unknown-class" || !lookup.catalog) {
    return { status: { kind: "missing_catalog" }, selections: {} };
  }

  return { status: { kind: "decoder_pending" }, selections: {} };
}

/**
 * Resolves a profile to its catalog lookup. Defaults to "unknown-class"
 * when no loader is supplied so tests that exercise the decoder in
 * isolation don't need to fabricate a loader just to get the absent /
 * missing_catalog branches.
 */
export type ProfileCatalogLookup = (
  profile: AplProfile,
) => CatalogLookupResult;

export function makeProfileCatalogLookup(
  loader: CatalogLoader,
): ProfileCatalogLookup {
  return (profile) => {
    const classSlug = profile.className;
    if (!classSlug || classSlug === "unknown") {
      return { status: "unknown-class" };
    }
    const specSlug = profile.specName;
    if (!specSlug) {
      return { status: "unknown-class" };
    }
    return loader.lookupSpec(classSlug, specSlug);
  };
}

/**
 * Walk every profile in a parsed document and produce the per-profile decode
 * map that `buildGraph` and `TalentModePanel` consume. Stable map ordering
 * matches `document.profiles` so callers can index by profile index without
 * extra bookkeeping.
 */
export function decodeDocumentTalents(
  document: AplDocument,
  resolveCatalog?: ProfileCatalogLookup,
): Map<number, TalentSelectionResult> {
  const byProfile = new Map<number, TalentSelectionResult>();
  for (
    let profileIndex = 0;
    profileIndex < document.profiles.length;
    profileIndex++
  ) {
    const profile = document.profiles[profileIndex];
    const lookup: CatalogLookupResult = resolveCatalog
      ? resolveCatalog(profile)
      : { status: "unknown-class" };
    byProfile.set(profileIndex, decodeProfileTalents(profile, lookup));
  }
  return byProfile;
}
