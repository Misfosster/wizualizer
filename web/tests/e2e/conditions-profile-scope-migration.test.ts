import { expect, test } from "@playwright/test";
import { parseDocument } from "../../src/utils/apl-parser/document";
import { getProfileScopeKey } from "../../src/utils/apl-parser/profile-scope";
import { migrateConditionOverridesForDocument } from "../../src/utils/conditions/profile-scope-migration";
import type { ConditionOverrides } from "../../src/utils/conditions/types";

function parseOrThrow(text: string) {
  const result = parseDocument(text);
  if (!result.ok) {
    throw new Error(`Parse failed: ${result.error}`);
  }
  return result.document;
}

test("legacy profile overrides fan out to every matching profile scope", () => {
  const document = parseOrThrow(`
shaman="Same"
actions=lava_lash

shaman="Same"
actions=stormstrike
`);
  const legacy: ConditionOverrides = {
    global: { "buff.global.up": true },
    byProfile: {
      Same: { "buff.hot_hand.up": false },
    },
  };

  const migrated = migrateConditionOverridesForDocument(legacy, document);
  const firstScopeKey = getProfileScopeKey(document.profiles[0]);
  const secondScopeKey = getProfileScopeKey(document.profiles[1]);

  expect(migrated.byProfile).toEqual({
    [firstScopeKey]: { "buff.hot_hand.up": false },
    [secondScopeKey]: { "buff.hot_hand.up": false },
  });
  expect(migrated.global).toEqual({ "buff.global.up": true });
});

test("profile scope migration is idempotent and preserves scope-specific values", () => {
  const document = parseOrThrow(`
shaman="Same"
actions=lava_lash
`);
  const scopeKey = getProfileScopeKey(document.profiles[0]);
  const mixed: ConditionOverrides = {
    global: {},
    byProfile: {
      Same: {
        "buff.hot_hand.up": false,
        "buff.ascendance.up": false,
      },
      [scopeKey]: {
        "buff.hot_hand.up": true,
      },
    },
  };

  const migrated = migrateConditionOverridesForDocument(mixed, document);
  expect(migrated.byProfile).toEqual({
    [scopeKey]: {
      "buff.hot_hand.up": true,
      "buff.ascendance.up": false,
    },
  });

  expect(migrateConditionOverridesForDocument(migrated, document)).toBe(
    migrated,
  );
});
