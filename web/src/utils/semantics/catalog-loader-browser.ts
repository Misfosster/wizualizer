import type { SemanticCatalog } from "./types";
import {
  createSemanticCatalogLoader,
  type SemanticCatalogLoader,
} from "./catalog-loader";

type ClassModule = () => Promise<SemanticCatalog>;

const CLASS_MODULES: Readonly<Record<string, ClassModule>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<SemanticCatalog>("../../data/semantics/*.json", {
      import: "default",
    }),
  )
    .map(([path, loader]) => {
      const match = /\/([^/]+)\.json$/.exec(path);
      return match ? [match[1], loader as ClassModule] : null;
    })
    .filter((entry): entry is [string, ClassModule] => entry !== null),
);

export const semanticCatalogLoader: SemanticCatalogLoader =
  createSemanticCatalogLoader((classSlug) => {
    if (classSlug === "unknown" || !(classSlug in CLASS_MODULES)) {
      return Promise.resolve(null);
    }
    return CLASS_MODULES[classSlug]();
  });

export function knownSemanticClassSlugs(): readonly string[] {
  return Object.keys(CLASS_MODULES).sort();
}
