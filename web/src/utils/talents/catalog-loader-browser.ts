import type { TalentCatalog } from "./types";
import { createCatalogLoader, type CatalogLoader } from "./catalog-loader";

/**
 * Browser-runtime wiring for the catalog loader.
 *
 * Isolated from `catalog-loader.ts` so the pure factory stays Node-safe
 * for unit tests. `import.meta.glob` is a Vite build-time transform; in
 * a raw Node runtime it would throw, and we do not want a test that
 * imports `catalog-loader.ts` to pull that in transitively.
 *
 * Vite sees the literal glob pattern below and produces a record
 * `{ "/absolute/.../shaman.json": () => Promise<TalentCatalog> }` at
 * build time. We normalise the keys so the lookup is just
 * `CLASS_MODULES["shaman"]`, regardless of how the path resolves.
 */

type ClassModule = () => Promise<TalentCatalog>;

const CLASS_MODULES: Readonly<Record<string, ClassModule>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<TalentCatalog>("../../data/talents/*.json", {
      import: "default",
    }),
  )
    .map(([path, loader]) => {
      const match = /\/([^/]+)\.json$/.exec(path);
      return match ? [match[1], loader as ClassModule] : null;
    })
    .filter((entry): entry is [string, ClassModule] => entry !== null),
);

/**
 * Singleton browser loader. All UI code should go through this rather
 * than constructing its own loader, so the cache is shared across the
 * editor store, the status panel, and any future consumers.
 */
export const catalogLoader: CatalogLoader = createCatalogLoader(
  (classSlug) => {
    if (classSlug === "unknown" || !(classSlug in CLASS_MODULES)) {
      return Promise.resolve(null);
    }
    return CLASS_MODULES[classSlug]();
  },
);

/**
 * List the class slugs we have catalogs committed for, sourced from the
 * same Vite manifest as the loader. Useful for diagnostics ("catalog
 * missing for <class>") without poking at the loader's internal cache.
 */
export function knownClassSlugs(): readonly string[] {
  return Object.keys(CLASS_MODULES).sort();
}
