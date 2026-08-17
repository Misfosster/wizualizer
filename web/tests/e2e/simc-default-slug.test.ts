import { expect, test } from "@playwright/test";
import {
  buildVariantLabel,
  parseMid1ProfileFilename,
  splitSpecPartIntoBaseAndVariant,
} from "../../src/utils/simc-defaults/slug-utils";

test("parseMid1ProfileFilename extracts class and spec segments", () => {
  expect(parseMid1ProfileFilename("MID1_Death_Knight_Frost_Rider.simc")).toEqual({
    classSegment: "Death_Knight",
    specPart: "Frost_Rider",
  });
  expect(parseMid1ProfileFilename("MID1_Hunter_Beast_Mastery.simc")).toEqual({
    classSegment: "Hunter",
    specPart: "Beast_Mastery",
  });
});

test("splitSpecPartIntoBaseAndVariant groups hero talent suffixes", () => {
  expect(
    splitSpecPartIntoBaseAndVariant("Frost_Rider", ["frost", "blood", "unholy"]),
  ).toEqual({ specSlug: "frost", variantSuffix: "rider" });
  expect(
    splitSpecPartIntoBaseAndVariant("Beast_Mastery", [
      "beast_mastery",
      "marksmanship",
    ]),
  ).toEqual({ specSlug: "beast_mastery", variantSuffix: null });
});

test("buildVariantLabel formats base and hero variants", () => {
  expect(buildVariantLabel("Frost", null)).toBe("Frost");
  expect(buildVariantLabel("Frost", "rider")).toBe("Frost (Rider)");
});
