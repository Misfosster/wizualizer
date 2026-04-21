import { expect, test } from "@playwright/test";
import type { AplProfile } from "../../src/utils/apl-parser/document";
import { createStaticCatalogLoader } from "../../src/utils/talents/catalog-loader";
import {
  decodeDocumentTalents,
  decodeProfileTalents,
  makeProfileCatalogLookup,
} from "../../src/utils/talents/decode-export";
import type { TalentCatalog, TalentSpecCatalog } from "../../src/utils/talents/types";
import {
  encodeTalentExport,
  loadTalentSpecCatalog,
  MIDNIGHT_ENHANCEMENT_STORMBRINGER_EXPORT,
  MIDNIGHT_ENHANCEMENT_TOTEMIC_EXPORT,
} from "./support/talent-export";

const SHAMAN_ENHANCEMENT = loadTalentSpecCatalog("shaman", "enhancement");

function profile(
  overrides: Partial<AplProfile> & Pick<AplProfile, "name" | "className">,
): AplProfile {
  return {
    name: overrides.name,
    className: overrides.className,
    blocks: overrides.blocks ?? [],
    ...(overrides.specName ? { specName: overrides.specName } : {}),
    ...(overrides.talentExport ? { talentExport: overrides.talentExport } : {}),
  };
}

test("decodeProfileTalents decodes a real Midnight enhancement export", () => {
  const result = decodeProfileTalents(
    profile({
      name: "Totemic",
      className: "shaman",
      specName: "enhancement",
      talentExport: MIDNIGHT_ENHANCEMENT_TOTEMIC_EXPORT,
    }),
    { status: "loaded", catalog: SHAMAN_ENHANCEMENT },
  );

  expect(result.status.kind).toBe("decoded");
  expect(result.selections.hot_hand).toBe(2);
  expect(result.selections.storm_unleashed).toBe(4);
  expect(result.selections.surging_totem).toBe(1);
  expect(result.selections.totemic_rebound).toBe(1);
  expect(result.selections.arc_discharge).toBeUndefined();
});

test("decodeProfileTalents decodes a real Midnight Stormbringer export", () => {
  const result = decodeProfileTalents(
    profile({
      name: "Stormbringer",
      className: "shaman",
      specName: "enhancement",
      talentExport: MIDNIGHT_ENHANCEMENT_STORMBRINGER_EXPORT,
    }),
    { status: "loaded", catalog: SHAMAN_ENHANCEMENT },
  );

  expect(result.status.kind).toBe("decoded");
  expect(result.selections.tempest).toBe(1);
  expect(result.selections.arc_discharge).toBe(1);
  expect(result.selections.totemic_rebound).toBeUndefined();
});

test("decodeProfileTalents decodes choice nodes from stream order", () => {
  const catalog: TalentSpecCatalog = {
    classId: 7,
    specId: 263,
    treeHash: "",
    classNodes: [],
    specNodes: [],
    streamNodes: [
      {
        nodeId: 10,
        maxRank: 1,
        grantedRanks: 0,
        nodeType: "choice",
        entries: [
          { entryId: 100, displayName: "Alpha", simcKey: "alpha" },
          { entryId: 101, displayName: "Beta", simcKey: "beta" },
        ],
      },
    ],
  };

  const talentExport = encodeTalentExport(catalog, {
    selectedRanks: { beta: 1 },
  });
  const result = decodeProfileTalents(
    profile({
      name: "Choice",
      className: "shaman",
      specName: "enhancement",
      talentExport,
    }),
    { status: "loaded", catalog },
  );

  expect(result.status.kind).toBe("decoded");
  expect(result.selections).toEqual({ beta: 1 });
});

test("decodeProfileTalents consumes subtree-selection nodes without inventing talents", () => {
  const catalog: TalentSpecCatalog = {
    classId: 7,
    specId: 263,
    treeHash: "",
    classNodes: [],
    specNodes: [],
    streamNodes: [
      {
        nodeId: 20,
        maxRank: 1,
        grantedRanks: 0,
        nodeType: "subtree_selection",
        entries: [
          { entryId: 200, displayName: "0", subTreeId: 54 },
          { entryId: 201, displayName: "0", subTreeId: 55 },
        ],
      },
      {
        nodeId: 21,
        maxRank: 1,
        grantedRanks: 0,
        nodeType: "normal",
        entries: [
          { entryId: 210, displayName: "Hero Talent", simcKey: "hero_talent" },
        ],
      },
    ],
  };

  const talentExport = encodeTalentExport(catalog, {
    selectedSubTrees: [55],
  });
  const result = decodeProfileTalents(
    profile({
      name: "Hero",
      className: "shaman",
      specName: "enhancement",
      talentExport,
    }),
    { status: "loaded", catalog },
  );

  expect(result.status.kind).toBe("decoded");
  expect(result.selections).toEqual({});
});

test("decodeProfileTalents reports version_mismatch on the wrong spec catalog", () => {
  const talentExport = encodeTalentExport(SHAMAN_ENHANCEMENT, {
    selectedRanks: { hot_hand: 1 },
    selectedSubTrees: [54],
  });
  const wrongCatalog: TalentSpecCatalog = {
    ...SHAMAN_ENHANCEMENT,
    specId: 262,
  };

  const result = decodeProfileTalents(
    profile({
      name: "Mismatch",
      className: "shaman",
      specName: "enhancement",
      talentExport,
    }),
    { status: "loaded", catalog: wrongCatalog },
  );

  expect(result.status.kind).toBe("version_mismatch");
});

test("decodeProfileTalents reports malformed_export for invalid strings", () => {
  const result = decodeProfileTalents(
    profile({
      name: "Broken",
      className: "shaman",
      specName: "enhancement",
      talentExport: "not*valid",
    }),
    { status: "loaded", catalog: SHAMAN_ENHANCEMENT },
  );

  expect(result.status.kind).toBe("malformed_export");
});

test("decodeDocumentTalents maps loader unsupported-spec results into profile statuses", async () => {
  const shamanOnly: TalentCatalog = {
    gameVersion: "12.0.1.66838",
    byClassSpec: {
      "shaman/enhancement": SHAMAN_ENHANCEMENT,
    },
  };
  const loader = createStaticCatalogLoader({ shaman: shamanOnly });
  const resolveCatalog = makeProfileCatalogLookup(loader);

  await loader.ensure("shaman");

  const selections = decodeDocumentTalents(
    {
      profiles: [
        profile({
          name: "Enhancement",
          className: "shaman",
          specName: "enhancement",
          talentExport: MIDNIGHT_ENHANCEMENT_TOTEMIC_EXPORT,
        }),
        profile({
          name: "Elemental",
          className: "shaman",
          specName: "elemental",
          talentExport: MIDNIGHT_ENHANCEMENT_TOTEMIC_EXPORT,
        }),
      ],
    },
    resolveCatalog,
  );

  expect(selections.get(0)?.status.kind).toBe("decoded");
  expect(selections.get(1)?.status.kind).toBe("unsupported_spec");
});
