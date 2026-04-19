import { expect, test } from "@playwright/test";
import {
  createCatalogLoader,
  createStaticCatalogLoader,
} from "../../src/utils/talents/catalog-loader";
import type { TalentCatalog } from "../../src/utils/talents/types";

const SHAMAN: TalentCatalog = {
  gameVersion: "11.2.7.64772",
  byClassSpec: {
    "shaman/enhancement": {
      classId: 7,
      specId: 263,
      treeHash: "",
      classNodes: [],
      specNodes: [],
    },
  },
};

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("ensure resolves with the fetched catalog and caches it for peek", async () => {
  const loader = createStaticCatalogLoader({ shaman: SHAMAN });

  expect(loader.peek("shaman")).toBeUndefined();
  const result = await loader.ensure("shaman");
  expect(result).toBe(SHAMAN);
  expect(loader.peek("shaman")).toBe(SHAMAN);
});

test("ensure dedupes concurrent loads for the same class", async () => {
  const gate = deferred<TalentCatalog>();
  let calls = 0;
  const loader = createCatalogLoader(async (slug) => {
    calls++;
    expect(slug).toBe("shaman");
    return gate.promise;
  });

  const a = loader.ensure("shaman");
  const b = loader.ensure("shaman");
  expect(calls).toBe(1);
  expect(loader.isLoading("shaman")).toBe(true);

  gate.resolve(SHAMAN);
  const [ra, rb] = await Promise.all([a, b]);
  expect(ra).toBe(SHAMAN);
  expect(rb).toBe(SHAMAN);
  expect(loader.isLoading("shaman")).toBe(false);
});

test("a null fetch result is remembered so we do not re-fetch", async () => {
  let calls = 0;
  const loader = createCatalogLoader(() => {
    calls++;
    return Promise.resolve(null);
  });

  expect(await loader.ensure("druid")).toBeNull();
  expect(await loader.ensure("druid")).toBeNull();
  expect(calls).toBe(1);
  expect(loader.peek("druid")).toBeNull();
});

test("lookupSpec distinguishes loading, unknown-class, and loaded", async () => {
  const gate = deferred<TalentCatalog>();
  const loader = createCatalogLoader(async () => gate.promise);

  expect(loader.lookupSpec("shaman", "enhancement").status).toBe(
    "unknown-class",
  );

  const pending = loader.ensure("shaman");
  expect(loader.lookupSpec("shaman", "enhancement").status).toBe("loading");

  gate.resolve(SHAMAN);
  await pending;
  const hit = loader.lookupSpec("shaman", "enhancement");
  expect(hit.status).toBe("loaded");
  expect(hit.catalog?.specId).toBe(263);

  const miss = loader.lookupSpec("shaman", "elemental");
  expect(miss.status).toBe("unknown-class");
});

test("onLoaded fires after the cache is populated and supports unsubscription", async () => {
  const loader = createStaticCatalogLoader({ shaman: SHAMAN });
  const events: string[] = [];
  const unsubscribe = loader.onLoaded((slug) => {
    events.push(slug);
    // Subscribers can call peek synchronously and see the final value.
    expect(loader.peek(slug)).toBe(SHAMAN);
  });

  await loader.ensure("shaman");
  expect(events).toEqual(["shaman"]);

  unsubscribe();
  await loader.ensure("druid");
  expect(events).toEqual(["shaman"]);
});

test("a fetcher throwing is captured and reported as unknown-class", async () => {
  const loader = createCatalogLoader(() =>
    Promise.reject(new Error("network down")),
  );
  const warn = console.warn;
  const warnings: unknown[] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    const result = await loader.ensure("druid");
    expect(result).toBeNull();
    expect(loader.lookupSpec("druid", "balance").status).toBe("unknown-class");
  } finally {
    console.warn = warn;
  }
  expect(warnings.length).toBeGreaterThan(0);
});
