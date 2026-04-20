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

const PROFILE_SCOPE = { profile: "Enhance" };

test("setOverride adds a new profile override without touching global", () => {
  const next = setOverride(
    EMPTY_CONDITION_OVERRIDES,
    PROFILE_SCOPE,
    "buff.hot_hand.up",
    true,
  );

  expect(next).not.toBe(EMPTY_CONDITION_OVERRIDES);
  expect(next.global).toEqual({});
  expect(next.byProfile).toEqual({
    Enhance: { "buff.hot_hand.up": true },
  });
});

test("setOverride is a no-op when the profile value is unchanged", () => {
  const initial = setOverride(
    EMPTY_CONDITION_OVERRIDES,
    PROFILE_SCOPE,
    "buff.hot_hand.up",
    true,
  );
  const again = setOverride(
    initial,
    PROFILE_SCOPE,
    "buff.hot_hand.up",
    true,
  );

  expect(again).toBe(initial);
});

test("setOverride toggles one profile key without losing siblings", () => {
  const a = setOverride(
    EMPTY_CONDITION_OVERRIDES,
    PROFILE_SCOPE,
    "buff.hot_hand.up",
    true,
  );
  const b = setOverride(a, PROFILE_SCOPE, "buff.ascendance.up", false);
  const c = setOverride(b, PROFILE_SCOPE, "buff.hot_hand.up", false);

  expect(c.byProfile.Enhance).toEqual({
    "buff.ascendance.up": false,
    "buff.hot_hand.up": false,
  });
});

test("setOverride stores numeric values in a profile scope", () => {
  const next = setOverride(
    EMPTY_CONDITION_OVERRIDES,
    PROFILE_SCOPE,
    "cooldown.hot_hand.remains",
    1.25,
  );

  expect(next.byProfile.Enhance).toEqual({
    "cooldown.hot_hand.remains": 1.25,
  });
});

test("clearOverride removes one profile key and keeps the profile scope", () => {
  const overrides: ConditionOverrides = {
    global: {},
    byProfile: {
      Enhance: {
        "buff.hot_hand.up": true,
        "buff.ascendance.up": false,
      },
    },
  };

  const cleared = clearOverride(overrides, PROFILE_SCOPE, "buff.hot_hand.up");

  expect(cleared.byProfile).toEqual({
    Enhance: { "buff.ascendance.up": false },
  });
});

test("clearOverride collapses an emptied profile scope", () => {
  const overrides: ConditionOverrides = {
    global: {},
    byProfile: {
      Enhance: { "buff.hot_hand.up": true },
    },
  };

  const cleared = clearOverride(overrides, PROFILE_SCOPE, "buff.hot_hand.up");

  expect(cleared).toBe(EMPTY_CONDITION_OVERRIDES);
});

test("clearOverride is a no-op when the profile key was never set", () => {
  const overrides: ConditionOverrides = {
    global: {},
    byProfile: {
      Enhance: { "buff.hot_hand.up": true },
    },
  };

  const cleared = clearOverride(overrides, PROFILE_SCOPE, "buff.unknown.up");

  expect(cleared).toBe(overrides);
});

test("clearScope removes only the requested profile", () => {
  const overrides: ConditionOverrides = {
    global: { "buff.global.up": true },
    byProfile: {
      Enhance: { "buff.hot_hand.up": true },
      Storm: { "buff.ascendance.up": false },
    },
  };

  const cleared = clearScope(overrides, PROFILE_SCOPE);

  expect(cleared.global).toEqual({ "buff.global.up": true });
  expect(cleared.byProfile).toEqual({
    Storm: { "buff.ascendance.up": false },
  });
});

test("getOverrideValue and countOverrides read the requested profile scope", () => {
  const overrides: ConditionOverrides = {
    global: { "buff.hot_hand.up": false },
    byProfile: {
      Enhance: {
        "buff.hot_hand.up": true,
        "buff.ascendance.up": false,
      },
    },
  };

  expect(getOverrideValue(overrides, PROFILE_SCOPE, "buff.hot_hand.up")).toBe(
    true,
  );
  expect(
    getOverrideValue(overrides, { profile: "Other" }, "buff.hot_hand.up"),
  ).toBeUndefined();
  expect(countOverrides(overrides, PROFILE_SCOPE)).toBe(2);
  expect(countOverrides(overrides, { profile: "Other" })).toBe(0);
});
