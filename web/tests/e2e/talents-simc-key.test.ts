import { expect, test } from "@playwright/test";
import {
  resolveSimcKey,
  simmifyTalentName,
} from "../../src/utils/talents/simc-key";

test("simmifyTalentName lowercases and replaces spaces with underscore", () => {
  expect(simmifyTalentName("Lava Lash")).toBe("lava_lash");
  expect(simmifyTalentName("Surging Totem")).toBe("surging_totem");
});

test("simmifyTalentName strips ASCII apostrophes without substitution", () => {
  expect(simmifyTalentName("Thorim's Invocation")).toBe("thorims_invocation");
  expect(simmifyTalentName("Hunter's Mark")).toBe("hunters_mark");
});

test("simmifyTalentName strips curly apostrophes without substitution", () => {
  expect(simmifyTalentName("Thorim\u2019s Invocation")).toBe(
    "thorims_invocation",
  );
});

test("simmifyTalentName collapses multiple non-alphanumeric runs to one underscore", () => {
  expect(simmifyTalentName("Storm -- Bringer!")).toBe("storm_bringer");
});

test("simmifyTalentName trims leading and trailing underscores", () => {
  expect(simmifyTalentName("! Doom Winds ?")).toBe("doom_winds");
});

test("simmifyTalentName strips combining diacritics", () => {
  expect(simmifyTalentName("N\u00eftro Fu\u00e9go")).toBe("nitro_fuego");
});

test("resolveSimcKey prefers an explicit key over the tokenised fallback", () => {
  expect(resolveSimcKey("Hot Hand", "hot_hand_override")).toBe(
    "hot_hand_override",
  );
});

test("resolveSimcKey falls back to simmifyTalentName when no explicit key is given", () => {
  expect(resolveSimcKey("Hot Hand")).toBe("hot_hand");
  expect(resolveSimcKey("Hot Hand", "")).toBe("hot_hand");
});
