import type { TalentSpecCatalogModule } from "./types";
import { createCatalogLoader, type CatalogLoader } from "./catalog-loader";

/**
 * Browser-runtime wiring for the catalog loader.
 *
 * Isolated from `catalog-loader.ts` so the pure factory stays Node-safe
 * for unit tests. `import.meta.glob` is a Vite build-time transform; in
 * a raw Node runtime it would throw, and we do not want a test that
 * imports `catalog-loader.ts` to pull that in transitively.
 *
 * Vite sees the literal glob pattern below and produces one lazy chunk per
 * class/spec catalog. We normalise the keys so runtime lookup is just
 * `SPEC_MODULES["shaman/enhancement"]`, regardless of how the path resolves.
 */

type SpecModule = () => Promise<TalentSpecCatalogModule>;

const SPEC_MODULES: Readonly<Record<string, SpecModule | undefined>> =
  Object.fromEntries(
    Object.entries(
      import.meta.glob<TalentSpecCatalogModule>(
        "../../data/talents/specs/*.json",
        {
          import: "default",
        },
      ),
    )
      .map(([path, loader]) => {
        const match = /\/([^/]+)__([^/]+)\.json$/.exec(path);
        return match
          ? [`${match[1]}/${match[2]}`, loader as SpecModule]
          : null;
      })
      .filter((entry): entry is [string, SpecModule] => entry !== null),
  );

/**
 * Singleton browser loader. All UI code should go through this rather
 * than constructing its own loader, so the cache is shared across the
 * editor store, the status panel, and any future consumers.
 */
export const catalogLoader: CatalogLoader = createCatalogLoader(
  async (classSlug, specSlug) => {
    if (classSlug === "unknown") {
      return Promise.resolve(null);
    }
    if (specSlug) {
      const classSpec = `${classSlug}/${specSlug}`;
      const loadSpec = SPEC_MODULES[classSpec];
      if (!loadSpec) {
        return Promise.resolve(null);
      }
      const specModule = await loadSpec();
      return {
        gameVersion: specModule.gameVersion,
        byClassSpec: {
          [specModule.classSpec]: specModule.catalog,
        },
      };
    }

    return Promise.resolve(null);
  },
);

/**
 * List the class slugs we have catalogs committed for, sourced from the
 * same Vite manifest as the loader. Useful for diagnostics ("catalog
 * missing for <class>") without poking at the loader's internal cache.
 */
export function knownClassSlugs(): readonly string[] {
  return Array.from(
    new Set(Object.keys(SPEC_MODULES).map((key) => key.split("/")[0])),
  ).sort();
}
