import { expect, test } from "@playwright/test";
import { parseDocument } from "../../src/utils/apl-parser/document";
import {
  getProfileScopeKey,
  type ProfileScopeInput,
} from "../../src/utils/apl-parser/profile-scope";

function parseOrThrow(text: string) {
  const result = parseDocument(text);
  if (!result.ok) {
    throw new Error(`Parse failed: ${result.error}`);
  }
  return result.document;
}

test("getProfileScopeKey encodes the documented profile identity contract", () => {
  const cases: [string, ProfileScopeInput, string][] = [
    [
      "normal profile",
      {
        className: "shaman",
        name: "Enhancement",
        ordinalAmongSameNameSiblings: 0,
      },
      "profile:shaman:Enhancement:0",
    ],
    [
      "duplicate profile",
      {
        className: "shaman",
        name: "Enhancement",
        ordinalAmongSameNameSiblings: 1,
      },
      "profile:shaman:Enhancement:1",
    ],
    [
      "unknown class",
      {
        className: "unknown",
        name: "Untitled",
        ordinalAmongSameNameSiblings: 0,
      },
      "profile:unknown:Untitled:0",
    ],
    [
      "empty profile fallback",
      {
        className: "",
        name: "",
        ordinalAmongSameNameSiblings: 0,
      },
      "profile:unknown:Untitled:0",
    ],
    [
      "separator characters",
      {
        className: "deathknight",
        name: "A:B/C",
        ordinalAmongSameNameSiblings: 0,
      },
      "profile:deathknight:A%3AB%2FC:0",
    ],
  ];

  for (const [label, profile, expected] of cases) {
    expect(getProfileScopeKey(profile), label).toBe(expected);
  }
});

test("parseDocument assigns deterministic ordinals to duplicate profiles", () => {
  const document = parseOrThrow(`
shaman="Same"
actions=lava_lash

shaman="Same"
actions=stormstrike

mage="Same"
actions=fireball
`);

  expect(
    document.profiles.map((profile) => ({
      scopeKey: getProfileScopeKey(profile),
      ordinal: profile.ordinalAmongSameNameSiblings,
    })),
  ).toEqual([
    {
      scopeKey: "profile:shaman:Same:0",
      ordinal: 0,
    },
    {
      scopeKey: "profile:shaman:Same:1",
      ordinal: 1,
    },
    {
      scopeKey: "profile:mage:Same:0",
      ordinal: 0,
    },
  ]);
});
