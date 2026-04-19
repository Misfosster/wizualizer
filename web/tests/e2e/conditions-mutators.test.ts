import { test, expect } from "@playwright/test";
import {
  clearOverride,
  clearScope,
  countOverrides,
  getOverrideValue,
  setOverride,
} from "../../src/utils/conditions/mutators";
import {
  EMPTY_CONDITION_OVERRIDES,
  type ConditionOverrides,
} from "../../src/utils/conditions/types";

test("setOverride adds a new global override and returns a new object", () => {
  const next = setOverride(EMPTY_CONDITION_OVERRIDES, "global", "buff.x.up", true);
  expect(next).not.toBe(EMPTY_CONDITION_OVERRIDES);
  expect(next.global).toEqual({ "buff.x.up": true });
});

test("setOverride is a no-op when the value is unchanged (referential equality)", () => {
  const initial = setOverride(EMPTY_CONDITION_OVERRIDES, "global", "buff.x.up", true);
  const again = setOverride(initial, "global", "buff.x.up", true);
  expect(again).toBe(initial);
});

test("setOverride toggles boolean values without losing other entries", () => {
  const a = setOverride(EMPTY_CONDITION_OVERRIDES, "global", "buff.x.up", true);
  const b = setOverride(a, "global", "buff.y.up", false);
  const c = setOverride(b, "global", "buff.x.up", false);
  expect(c.global).toEqual({ "buff.x.up": false, "buff.y.up": false });
});

test("clearOverride removes one key while keeping siblings", () => {
  const overrides: ConditionOverrides = {
    global: { "buff.x.up": true, "buff.y.up": false },
    byProfile: {},
  };
  const cleared = clearOverride(overrides, "global", "buff.x.up");
  expect(cleared.global).toEqual({ "buff.y.up": false });
});

test("clearOverride is a no-op when the key was never set", () => {
  const overrides: ConditionOverrides = {
    global: { "buff.x.up": true },
    byProfile: {},
  };
  const cleared = clearOverride(overrides, "global", "buff.unknown.up");
  expect(cleared).toBe(overrides);
});

test("clearScope global empties the layer and collapses to the empty constant when nothing remains", () => {
  const overrides: ConditionOverrides = {
    global: { "buff.x.up": true },
    byProfile: {},
  };
  const cleared = clearScope(overrides, "global");
  expect(cleared).toBe(EMPTY_CONDITION_OVERRIDES);
});

test("clearScope global keeps per-profile entries intact", () => {
  const overrides: ConditionOverrides = {
    global: { "buff.x.up": true },
    byProfile: { Test: { "buff.y.up": false } },
  };
  const cleared = clearScope(overrides, "global");
  expect(cleared.global).toEqual({});
  expect(cleared.byProfile).toEqual({ Test: { "buff.y.up": false } });
});

test("setOverride per-profile does not touch the global layer", () => {
  const next = setOverride(
    EMPTY_CONDITION_OVERRIDES,
    { profile: "Test" },
    "buff.x.up",
    true,
  );
  expect(next.global).toEqual({});
  expect(next.byProfile).toEqual({ Test: { "buff.x.up": true } });
});

test("clearScope per-profile removes only the named profile", () => {
  const overrides: ConditionOverrides = {
    global: {},
    byProfile: {
      A: { "buff.x.up": true },
      B: { "buff.y.up": false },
    },
  };
  const cleared = clearScope(overrides, { profile: "A" });
  expect(cleared.byProfile).toEqual({ B: { "buff.y.up": false } });
});

test("getOverrideValue returns undefined when no override is set", () => {
  expect(
    getOverrideValue(EMPTY_CONDITION_OVERRIDES, "global", "buff.x.up"),
  ).toBeUndefined();
});

test("countOverrides reflects the number of entries in the requested scope", () => {
  const overrides: ConditionOverrides = {
    global: { "buff.x.up": true, "buff.y.up": false },
    byProfile: { Test: { "buff.z.up": true } },
  };
  expect(countOverrides(overrides, "global")).toBe(2);
  expect(countOverrides(overrides, { profile: "Test" })).toBe(1);
  expect(countOverrides(overrides, { profile: "Other" })).toBe(0);
});
