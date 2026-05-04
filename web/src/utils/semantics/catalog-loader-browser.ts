import type { SemanticSpecCatalogModule } from "./types";
import {
  createSemanticCatalogLoader,
  type SemanticCatalogLoader,
} from "./catalog-loader";

type SpecModule = () => Promise<SemanticSpecCatalogModule>;

const SPEC_MODULES: Readonly<Record<string, SpecModule | undefined>> =
  Object.fromEntries(
    Object.entries(
      import.meta.glob<SemanticSpecCatalogModule>(
        "../../data/semantics/specs/*.json",
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

export const semanticCatalogLoader: SemanticCatalogLoader =
  createSemanticCatalogLoader(async (classSlug, specSlug) => {
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
        v: specModule.v,
        gameVersion: specModule.gameVersion,
        byClassSpec: {
          [specModule.classSpec]: specModule.catalog,
        },
      };
    }

    return Promise.resolve(null);
  });

export function knownSemanticClassSlugs(): readonly string[] {
  return Array.from(
    new Set(Object.keys(SPEC_MODULES).map((key) => key.split("/")[0])),
  ).sort();
}
