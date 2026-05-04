import type { TalentCatalog, TalentSpecCatalog } from "./types";

/**
 * Fetches a `TalentCatalog`. Browser code passes both class and spec so it
 * can dynamic-import a single-spec chunk. Tests and legacy helpers may still
 * pass only class and return a per-class catalog.
 */
export type CatalogFetcher = (
  classSlug: string,
  specSlug?: string,
) => Promise<TalentCatalog | null>;

/**
 * Listener signature for catalog arrivals. Fired after the result - hit
 * or miss - is committed to the cache, so subscribers calling
 * `peek(slug)` inside the callback see the final value.
 */
export type CatalogLoadListener = (classSlug: string) => void;

export interface CatalogLookupResult {
  status: "loaded" | "loading" | "unknown-class" | "unsupported-spec";
  catalog?: TalentSpecCatalog;
}

/**
 * Small reactive cache sitting in front of a `CatalogFetcher`.
 *
 * Responsibilities:
 *  - Dedupe concurrent loads for the same class (`get` hands out the
 *    same promise to every caller until it settles).
 *  - Remember null results so we don't re-fetch classes we have no
 *    catalog for.
 *  - Offer a synchronous `peek` / `lookupSpec` pair so the editor store
 *    can do its decode pass without awaiting.
 *  - Notify listeners whenever the cache grows, so the store can
 *    rebuild derived state when a catalog arrives asynchronously.
 *
 * The loader itself does no decoding and does not care how the fetcher
 * actually retrieves a file - this keeps it trivially swappable in
 * tests (`createCatalogLoader(async () => FIXTURE)`).
 */
export interface CatalogLoader {
  ensure(classSlug: string, specSlug?: string): Promise<TalentCatalog | null>;
  peek(classSlug: string): TalentCatalog | null | undefined;
  lookupSpec(classSlug: string, specSlug: string): CatalogLookupResult;
  isLoading(classSlug: string, specSlug?: string): boolean;
  onLoaded(listener: CatalogLoadListener): () => void;
}

interface CacheEntry {
  catalog: TalentCatalog | null;
}

export function createCatalogLoader(fetcher: CatalogFetcher): CatalogLoader {
  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<TalentCatalog | null>>();
  const listeners = new Set<CatalogLoadListener>();

  function cacheKey(classSlug: string, specSlug?: string): string {
    return specSlug ? `${classSlug}/${specSlug}` : classSlug;
  }

  function peek(classSlug: string): TalentCatalog | null | undefined {
    const hit = cache.get(classSlug);
    return hit ? hit.catalog : undefined;
  }

  function notify(classSlug: string): void {
    for (const listener of listeners) {
      listener(classSlug);
    }
  }

  async function ensure(
    classSlug: string,
    specSlug?: string,
  ): Promise<TalentCatalog | null> {
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
          `catalog-loader: failed to load "${key}":`,
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
  ): CatalogLookupResult {
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

  function onLoaded(listener: CatalogLoadListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { ensure, peek, lookupSpec, isLoading, onLoaded };
}

/**
 * Convenience constructor for tests: pre-populates the cache with a
 * canned map and returns a loader that never performs real I/O.
 */
export function createStaticCatalogLoader(
  catalogsByClassSlug: Readonly<Record<string, TalentCatalog | null>>,
): CatalogLoader {
  return createCatalogLoader((classSlug) =>
    Promise.resolve(
      classSlug in catalogsByClassSlug
        ? catalogsByClassSlug[classSlug]
        : null,
    ),
  );
}
