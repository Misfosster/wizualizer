import type {
  SemanticCatalog,
  SemanticCatalogLookupResult,
} from "./types";

export type SemanticCatalogFetcher = (
  classSlug: string,
) => Promise<SemanticCatalog | null>;

export type SemanticCatalogLoadListener = (classSlug: string) => void;

export interface SemanticCatalogLoader {
  ensure(classSlug: string): Promise<SemanticCatalog | null>;
  peek(classSlug: string): SemanticCatalog | null | undefined;
  lookupSpec(
    classSlug: string,
    specSlug: string,
  ): SemanticCatalogLookupResult;
  isLoading(classSlug: string): boolean;
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

  function notify(classSlug: string): void {
    for (const listener of listeners) {
      listener(classSlug);
    }
  }

  function peek(classSlug: string): SemanticCatalog | null | undefined {
    return cache.get(classSlug)?.catalog;
  }

  async function ensure(classSlug: string): Promise<SemanticCatalog | null> {
    const cached = cache.get(classSlug);
    if (cached) {
      return cached.catalog;
    }

    const existing = inflight.get(classSlug);
    if (existing) {
      return existing;
    }

    const promise = fetcher(classSlug)
      .then((catalog) => {
        cache.set(classSlug, { catalog });
        inflight.delete(classSlug);
        notify(classSlug);
        return catalog;
      })
      .catch((error: unknown) => {
        cache.set(classSlug, { catalog: null });
        inflight.delete(classSlug);
        notify(classSlug);
        console.warn(
          `semantic-catalog-loader: failed to load class "${classSlug}":`,
          error,
        );
        return null;
      });

    inflight.set(classSlug, promise);
    return promise;
  }

  function lookupSpec(
    classSlug: string,
    specSlug: string,
  ): SemanticCatalogLookupResult {
    const cached = cache.get(classSlug);
    if (!cached) {
      return inflight.has(classSlug)
        ? { status: "loading" }
        : { status: "unknown-class" };
    }
    if (!cached.catalog) {
      return { status: "unknown-class" };
    }
    const key = `${classSlug}/${specSlug}`;
    if (!(key in cached.catalog.byClassSpec)) {
      return { status: "unsupported-spec" };
    }
    return { status: "loaded", catalog: cached.catalog.byClassSpec[key] };
  }

  function isLoading(classSlug: string): boolean {
    return inflight.has(classSlug);
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
