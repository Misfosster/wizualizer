import { expect, test } from "@playwright/test";
import manifest from "../../src/data/simc-defaults/manifest.json" with { type: "json" };
import {
  clearSimcDefaultProfileCache,
  fetchSimcDefaultProfile,
} from "../../src/utils/simc-defaults/fetch-default-apl";
import { SimcDefaultFetchError } from "../../src/utils/simc-defaults/types";

test.afterEach(() => {
  clearSimcDefaultProfileCache();
});

test("fetchSimcDefaultProfile returns text and caches by filename", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(
      new Response("monk=\"Cached\"\nactions=auto_attack", { status: 200 }),
    );
  };

  try {
    const first = await fetchSimcDefaultProfile("MID1_Monk_Windwalker.simc");
    const second = await fetchSimcDefaultProfile("MID1_Monk_Windwalker.simc");
    expect(first.text).toContain("monk=");
    expect(second.text).toBe(first.text);
    expect(calls).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchSimcDefaultProfile maps HTTP failures to typed errors", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = () => Promise.resolve(new Response("", { status: 404 }));
  try {
    await expect(
      fetchSimcDefaultProfile("MID1_Monk_Windwalker.simc"),
    ).rejects.toMatchObject({ code: "not_found" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = () => Promise.reject(new TypeError("network down"));
  try {
    await expect(
      fetchSimcDefaultProfile("MID1_Monk_Windwalker.simc"),
    ).rejects.toMatchObject({ code: "offline" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = () => Promise.resolve(new Response("", { status: 500 }));
  try {
    await expect(
      fetchSimcDefaultProfile("MID1_Monk_Windwalker.simc"),
    ).rejects.toBeInstanceOf(SimcDefaultFetchError);
    await expect(
      fetchSimcDefaultProfile("MID1_Monk_Windwalker.simc"),
    ).rejects.toMatchObject({ code: "http_error" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("simc defaults manifest has expected shape", () => {
  expect(manifest.source).toBe("simulationcraft/simc");
  expect(manifest.ref).toBeTruthy();
  expect(manifest.directory).toBe("profiles/MID1");
  expect(manifest.classes.length).toBeGreaterThan(0);

  for (const classEntry of manifest.classes) {
    expect(classEntry.slug.length).toBeGreaterThan(0);
    expect(classEntry.label.length).toBeGreaterThan(0);
    expect(classEntry.specs.length).toBeGreaterThan(0);

    for (const spec of classEntry.specs) {
      expect(spec.variants.length).toBeGreaterThan(0);
      for (const variant of spec.variants) {
        expect(variant.file).toMatch(/^MID1_.+\.simc$/);
        expect(variant.label.length).toBeGreaterThan(0);
      }
    }
  }
});
