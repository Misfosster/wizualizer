import type { AplDocument } from "@/utils/apl-parser/document";
import { semanticCatalogLoader } from "@/utils/semantics/catalog-loader-browser";
import { catalogLoader } from "@/utils/talents/catalog-loader-browser";
import {
  decodeDocumentTalents,
  makeProfileCatalogLookup,
  type ProfileCatalogLookup,
} from "@/utils/talents/decode-export";
import type { TalentSelectionResult } from "@/utils/talents/types";

const EMPTY_SELECTIONS: ReadonlyMap<number, TalentSelectionResult> = new Map();

const resolveCatalogForProfile: ProfileCatalogLookup =
  makeProfileCatalogLookup(catalogLoader);

export { catalogLoader, semanticCatalogLoader };

export function prefetchCatalogsFor(document: AplDocument | null): void {
  if (!document) return;
  const seen = new Set<string>();
  for (const profile of document.profiles) {
    const slug = profile.className;
    if (!slug || slug === "unknown" || seen.has(slug)) continue;
    seen.add(slug);
    void catalogLoader.ensure(slug);
    void semanticCatalogLoader.ensure(slug);
  }
}

export function decodeSelections(
  document: AplDocument | null,
): ReadonlyMap<number, TalentSelectionResult> {
  return document
    ? decodeDocumentTalents(document, resolveCatalogForProfile)
    : EMPTY_SELECTIONS;
}

export function selectionsEqual(
  a: ReadonlyMap<number, TalentSelectionResult>,
  b: ReadonlyMap<number, TalentSelectionResult>,
): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [index, left] of a) {
    const right = b.get(index);
    if (!right) return false;
    if (left.status.kind !== right.status.kind) return false;
    const leftKeys = Object.keys(left.selections);
    const rightKeys = Object.keys(right.selections);
    if (leftKeys.length !== rightKeys.length) return false;
    for (const key of leftKeys) {
      if (left.selections[key] !== right.selections[key]) return false;
    }
  }
  return true;
}
