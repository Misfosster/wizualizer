import type {
  SemanticCatalog,
  SemanticCatalogLookupResult,
} from "./types";

export type SemanticCatalogFetcher = (
  classSlug: string,
  specSlug?: string,
) => Promise<SemanticCatalog | null>;

export type SemanticCatalogLoadListener = (classSlug: string) => void;

export interface SemanticCatalogLoader {
  ensure(classSlug: string, specSlug?: string): Promise<SemanticCatalog | null>;
  peek(classSlug: string): SemanticCatalog | null | undefined;
  lookupSpec(
    classSlug: string,
    specSlug: string,
  ): SemanticCatalogLookupResult;
  isLoading(classSlug: string, specSlug?: string): boolean;
  onLoaded(listener: SemanticCatalogLoadListener): () => void;
}

interface CacheEntry {
  catalog: SemanticCatalog | null;
}

export function createSemanticCatalogLoader(
  fetcher: SemanticCatalogFetcher,
): SemanticCatalogLoader {
  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<SemanticCatalog | null>>();
  const listeners = new Set<SemanticCatalogLoadListener>();

  function cacheKey(classSlug: string, specSlug?: string): string {
    return specSlug ? `${classSlug}/${specSlug}` : classSlug;
  }

  function notify(classSlug: string): void {
    for (const listener of listeners) {
      listener(classSlug);
    }
  }

  function peek(classSlug: string): SemanticCatalog | null | undefined {
    return cache.get(classSlug)?.catalog;
  }

  async function ensure(
    classSlug: string,
    specSlug?: string,
  ): Promise<SemanticCatalog | null> {
    const key = cacheKey(classSlug, specSlug);
    const cached = cache.get(key);
    if (cached) {
      return cached.catalog;
    }

    const existing = inflight.get(key);
    if (existing) {
      return existing;
    }

    const promise = fetcher(classSlug, specSlug)
      .then((catalog) => {
        cache.set(key, { catalog });
        inflight.delete(key);
        notify(classSlug);
        return catalog;
      })
      .catch((error: unknown) => {
        cache.set(key, { catalog: null });
        inflight.delete(key);
        notify(classSlug);
        console.warn(
          `semantic-catalog-loader: failed to load "${key}":`,
          error,
        );
        return null;
      });

    inflight.set(key, promise);
    return promise;
  }

  function lookupSpec(
    classSlug: string,
    specSlug: string,
  ): SemanticCatalogLookupResult {
    const key = `${classSlug}/${specSlug}`;
    const cachedSpec = cache.get(key);
    if (cachedSpec) {
      if (!cachedSpec.catalog) {
        return { status: "unsupported-spec" };
      }
      if (!Object.hasOwn(cachedSpec.catalog.byClassSpec, key)) {
        return { status: "unsupported-spec" };
      }
      return {
        status: "loaded",
        catalog: cachedSpec.catalog.byClassSpec[key],
      };
    }
    if (inflight.has(key)) {
      return { status: "loading" };
    }

    const cached = cache.get(classSlug);
    if (!cached) {
      return inflight.has(classSlug)
        ? { status: "loading" }
        : { status: "unknown-class" };
    }
    if (!cached.catalog) {
      return { status: "unknown-class" };
    }
    if (!Object.hasOwn(cached.catalog.byClassSpec, key)) {
      return { status: "unsupported-spec" };
    }
    return { status: "loaded", catalog: cached.catalog.byClassSpec[key] };
  }

  function isLoading(classSlug: string, specSlug?: string): boolean {
    if (specSlug) {
      return inflight.has(cacheKey(classSlug, specSlug));
    }
    if (inflight.has(classSlug)) {
      return true;
    }
    const prefix = `${classSlug}/`;
    return Array.from(inflight.keys()).some((key) => key.startsWith(prefix));
  }

  function onLoaded(listener: SemanticCatalogLoadListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { ensure, peek, lookupSpec, isLoading, onLoaded };
}

export function createStaticSemanticCatalogLoader(
  catalogsByClassSlug: Readonly<Record<string, SemanticCatalog | null>>,
): SemanticCatalogLoader {
  return createSemanticCatalogLoader((classSlug) =>
    Promise.resolve(
      classSlug in catalogsByClassSlug
        ? catalogsByClassSlug[classSlug]
        : null,
    ),
  );
}
