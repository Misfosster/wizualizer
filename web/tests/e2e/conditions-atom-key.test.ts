import { test, expect } from "@playwright/test";
import {
  canonicalAtomKey,
  isTalentAtomKey,
  parseAtomKey,
  talentSimcKey,
} from "../../src/utils/conditions/atom-key";

test("canonicalAtomKey lowercases and strips whitespace", () => {
  expect(canonicalAtomKey("Buff.Ascendance.Up")).toBe("buff.ascendance.up");
  expect(canonicalAtomKey("  buff .  ascendance . up  ")).toBe(
    "buff.ascendance.up",
  );
});

test("parseAtomKey splits namespace, subject, property", () => {
  expect(parseAtomKey("buff.ascendance.up")).toEqual({
    namespace: "buff",
    subject: "ascendance",
    property: "up",
  });
  expect(parseAtomKey("talent.storm_unleashed")).toEqual({
    namespace: "talent",
    subject: "storm_unleashed",
    property: "",
  });
  expect(parseAtomKey("talent.storm_unleashed.enabled")).toEqual({
    namespace: "talent",
    subject: "storm_unleashed",
    property: "enabled",
  });
});

test("parseAtomKey keeps deeper paths in property", () => {
  expect(parseAtomKey("trinket.1.is.algethar_puzzle_box")).toEqual({
    namespace: "trinket",
    subject: "1",
    property: "is.algethar_puzzle_box",
  });
});

test("parseAtomKey treats single-segment names as bare namespaces", () => {
  expect(parseAtomKey("fight_remains")).toEqual({
    namespace: "fight_remains",
    subject: "",
    property: "",
  });
});

test("isTalentAtomKey only matches the talent namespace", () => {
  expect(isTalentAtomKey("talent.foo")).toBe(true);
  expect(isTalentAtomKey("talent")).toBe(true);
  expect(isTalentAtomKey("buff.foo")).toBe(false);
  expect(isTalentAtomKey("talented.foo")).toBe(false);
});

test("talentSimcKey extracts the second segment from a talent atom", () => {
  expect(talentSimcKey("talent.storm_unleashed.enabled")).toBe(
    "storm_unleashed",
  );
  expect(talentSimcKey("buff.ascendance.up")).toBeNull();
  expect(talentSimcKey("talent")).toBeNull();
});
