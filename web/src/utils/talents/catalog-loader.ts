import type { TalentCatalog, TalentSpecCatalog } from "./types";

/**
 * Fetches one per-class `TalentCatalog`, e.g. by dynamic-importing
 * `src/data/talents/<slug>.json`. Failures are expected (a profile may
 * use an unknown class slug, or we may have no catalog committed yet) -
 * return `null` rather than throwing so the loader can cache the
 * "nothing to find" outcome and not retry forever.
 */
export type CatalogFetcher = (
  classSlug: string,
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
  ensure(classSlug: string): Promise<TalentCatalog | null>;
  peek(classSlug: string): TalentCatalog | null | undefined;
  lookupSpec(classSlug: string, specSlug: string): CatalogLookupResult;
  isLoading(classSlug: string): boolean;
  onLoaded(listener: CatalogLoadListener): () => void;
}

interface CacheEntry {
  catalog: TalentCatalog | null;
}

export function createCatalogLoader(fetcher: CatalogFetcher): CatalogLoader {
  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<TalentCatalog | null>>();
  const listeners = new Set<CatalogLoadListener>();

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
  ): Promise<TalentCatalog | null> {
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
          `catalog-loader: failed to load class "${classSlug}":`,
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
  ): CatalogLookupResult {
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
    const { byClassSpec } = cached.catalog;
    if (!(key in byClassSpec)) {
      return { status: "unsupported-spec" };
    }
    return { status: "loaded", catalog: byClassSpec[key] };
  }

  function isLoading(classSlug: string): boolean {
    return inflight.has(classSlug);
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
