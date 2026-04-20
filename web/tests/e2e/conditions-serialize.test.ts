import { test, expect } from "@playwright/test";
import {
  deserializeConditionOverrides,
  serializeConditionOverrides,
} from "../../src/utils/conditions/serialize";
import {
  EMPTY_CONDITION_OVERRIDES,
  type ConditionOverrides,
} from "../../src/utils/conditions/types";

test("round-trip preserves global and per-profile entries", () => {
  const overrides: ConditionOverrides = {
    global: {
      "buff.ascendance.up": true,
      "cooldown.doom_winds.remains": 3.5,
      "talent.storm_unleashed.enabled": false,
    },
    byProfile: {
      Test: { "buff.hot_hand.up": false },
    },
  };
  const json = serializeConditionOverrides(overrides);
  const parsed = deserializeConditionOverrides(json);
  expect(parsed).toEqual(overrides);
});

test("null / empty input yields the empty constant", () => {
  expect(deserializeConditionOverrides(null)).toEqual(
    EMPTY_CONDITION_OVERRIDES,
  );
  expect(deserializeConditionOverrides("")).toEqual(EMPTY_CONDITION_OVERRIDES);
});

test("malformed JSON falls back to empty rather than throwing", () => {
  expect(deserializeConditionOverrides("not json")).toEqual(
    EMPTY_CONDITION_OVERRIDES,
  );
});

test("wrong version blob is treated as empty", () => {
  const stale = JSON.stringify({ v: 99, global: { foo: true } });
  expect(deserializeConditionOverrides(stale)).toEqual(
    EMPTY_CONDITION_OVERRIDES,
  );
});

test("non-boolean / non-number override values are filtered out", () => {
  const dirty = JSON.stringify({
    v: 1,
    global: { "buff.x.up": true, "buff.y.up": "yes", "buff.z.up": 1 },
  });
  const parsed = deserializeConditionOverrides(dirty);
  expect(parsed.global).toEqual({ "buff.x.up": true, "buff.z.up": 1 });
});
