import type { AplDocument, AplProfile } from "@/utils/apl-parser/document";
import type { CatalogLoader, CatalogLookupResult } from "./catalog-loader";
import type {
  TalentSelectionResult,
  TalentSpecCatalog,
  TalentStreamNode,
} from "./types";

const EXPORT_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const SUPPORTED_LOADOUT_SERIALIZATION_VERSION = 2;
const HEADER_VERSION_BITS = 8;
const SPEC_ID_BITS = 16;
const TREE_HASH_BYTES = 16;
const RANK_BITS = 6;
const CHOICE_INDEX_BITS = 2;

/**
 * Decode a single profile's `talents=` export string into selected talent
 * ranks keyed by SimC talent key.
 *
 * Decoder status rules:
 *   - `absent`:            no `talents=` line on the profile
 *   - `loading`:           class catalog is being fetched
 *   - `missing_catalog`:   class is unknown to us (no JSON committed)
 *   - `unsupported_spec`:  class catalog exists but that spec slug is not
 *                          present in the catalog
 *   - `version_mismatch`:  export header does not match the catalog /
 *                          supported serialization version
 *   - `malformed_export`:  export string could not be parsed safely
 *   - `decoded`:           selections are trustworthy and may filter the graph
 */
export function decodeProfileTalents(
  profile: AplProfile,
  lookup: CatalogLookupResult,
): TalentSelectionResult {
  if (!profile.talentExport) {
    return { status: { kind: "absent" }, selections: {} };
  }

  if (lookup.status === "loading") {
    return { status: { kind: "loading" }, selections: {} };
  }

  if (lookup.status === "unsupported-spec") {
    return { status: { kind: "unsupported_spec" }, selections: {} };
  }

  if (lookup.status === "unknown-class" || !lookup.catalog) {
    return { status: { kind: "missing_catalog" }, selections: {} };
  }

  return decodeTalentExport(profile.talentExport, lookup.catalog);
}

export type ProfileCatalogLookup = (
  profile: AplProfile,
) => CatalogLookupResult;

export function makeProfileCatalogLookup(
  loader: CatalogLoader,
): ProfileCatalogLookup {
  return (profile) => {
    const classSlug = profile.className;
    if (!classSlug || classSlug === "unknown") {
      return { status: "unknown-class" };
    }
    const specSlug = profile.specName;
    if (!specSlug) {
      return { status: "unknown-class" };
    }
    return loader.lookupSpec(classSlug, specSlug);
  };
}

/**
 * Walk every profile in a parsed document and produce the per-profile decode
 * map that `buildGraph` and `TalentModePanel` consume. Stable map ordering
 * matches `document.profiles` so callers can index by profile index without
 * extra bookkeeping.
 */
export function decodeDocumentTalents(
  document: AplDocument,
  resolveCatalog?: ProfileCatalogLookup,
): Map<number, TalentSelectionResult> {
  const byProfile = new Map<number, TalentSelectionResult>();
  for (
    let profileIndex = 0;
    profileIndex < document.profiles.length;
    profileIndex++
  ) {
    const profile = document.profiles[profileIndex];
    const lookup: CatalogLookupResult = resolveCatalog
      ? resolveCatalog(profile)
      : { status: "unknown-class" };
    byProfile.set(profileIndex, decodeProfileTalents(profile, lookup));
  }
  return byProfile;
}

function decodeTalentExport(
  exportString: string,
  catalog: TalentSpecCatalog,
): TalentSelectionResult {
  let stream: ImportDataStream;
  try {
    stream = new ImportDataStream(exportString);
  } catch {
    return { status: { kind: "malformed_export" }, selections: {} };
  }

  try {
    const version = stream.extractValue(HEADER_VERSION_BITS);
    if (version !== SUPPORTED_LOADOUT_SERIALIZATION_VERSION) {
      return { status: { kind: "version_mismatch" }, selections: {} };
    }

    const specId = stream.extractValue(SPEC_ID_BITS);
    if (specId !== catalog.specId) {
      return { status: { kind: "version_mismatch" }, selections: {} };
    }

    const treeHash = readTreeHash(stream);
    if (hasTreeHashMismatch(catalog.treeHash, treeHash)) {
      return { status: { kind: "version_mismatch" }, selections: {} };
    }

    const selections: Record<string, number> = {};
    for (const node of getStreamNodes(catalog)) {
      decodeNodeInto(stream, node, selections);
    }

    return { status: { kind: "decoded" }, selections };
  } catch {
    return { status: { kind: "malformed_export" }, selections: {} };
  }
}

function decodeNodeInto(
  stream: ImportDataStream,
  node: TalentStreamNode,
  selections: Record<string, number>,
): void {
  const isSelected = stream.extractValue(1) === 1;
  if (!isSelected) {
    return;
  }

  const isPurchased = stream.extractValue(1) === 1;
  if (!isPurchased) {
    const grantedRank = node.grantedRanks > 0 ? node.grantedRanks : node.maxRank;
    const grantedKey = node.entries[0]?.simcKey;
    if (grantedKey && grantedRank > 0) {
      selections[grantedKey] = Math.max(selections[grantedKey] ?? 0, grantedRank);
    }
    return;
  }

  let rank = node.maxRank > 0 ? node.maxRank : 1;
  const isPartiallyRanked = stream.extractValue(1) === 1;
  if (isPartiallyRanked) {
    rank = stream.extractValue(RANK_BITS);
  }

  const isChoiceNode = stream.extractValue(1) === 1;
  let simcKey = node.entries[0]?.simcKey;
  if (isChoiceNode) {
    const entryIndex = stream.extractValue(CHOICE_INDEX_BITS);
    const entry = node.entries.at(entryIndex);
    if (entry === undefined) {
      throw new Error("choice index out of range");
    }
    simcKey = entry.simcKey;
  }

  if (!simcKey || rank <= 0) {
    return;
  }
  selections[simcKey] = Math.max(selections[simcKey] ?? 0, rank);
}

function readTreeHash(stream: ImportDataStream): string {
  let hash = "";
  for (let i = 0; i < TREE_HASH_BYTES; i++) {
    hash += stream.extractValue(8).toString(16).padStart(2, "0");
  }
  return hash;
}

function hasTreeHashMismatch(
  expected: string,
  actual: string,
): boolean {
  const normalizedExpected = normalizeHash(expected);
  if (!normalizedExpected) {
    return false;
  }
  return normalizedExpected !== normalizeHash(actual);
}

function normalizeHash(value: string): string {
  return value.toLowerCase().replace(/[^0-9a-f]/g, "");
}

function getStreamNodes(catalog: TalentSpecCatalog): readonly TalentStreamNode[] {
  if (catalog.streamNodes && catalog.streamNodes.length > 0) {
    return catalog.streamNodes;
  }

  return [
    ...catalog.classNodes.map(toLegacyStreamNode),
    ...catalog.specNodes.map(toLegacyStreamNode),
    ...(catalog.heroNodes ?? []).map(toLegacyStreamNode),
  ];
}

function toLegacyStreamNode(node: {
  talentId: number;
  displayName: string;
  simcKey: string;
  maxRank: number;
  nodeType?: "normal" | "choice";
  choices?: readonly { talentId: number; displayName: string; simcKey: string }[];
}): TalentStreamNode {
  if (node.nodeType === "choice" && node.choices && node.choices.length > 0) {
    return {
      nodeId: node.talentId,
      maxRank: node.maxRank,
      grantedRanks: node.maxRank,
      nodeType: "choice",
      entries: node.choices.map((choice) => ({
        entryId: choice.talentId,
        displayName: choice.displayName,
        simcKey: choice.simcKey,
      })),
    };
  }

  return {
    nodeId: node.talentId,
    maxRank: node.maxRank,
    grantedRanks: node.maxRank,
    nodeType: "normal",
    entries: [
      {
        entryId: node.talentId,
        displayName: node.displayName,
        simcKey: node.simcKey,
      },
    ],
  };
}

class ImportDataStream {
  private readonly values: number[];
  private bitHead = 0;

  constructor(exportString: string) {
    if (!exportString || exportString.length === 0) {
      throw new Error("empty export");
    }

    this.values = Array.from(exportString, (char) => {
      const value = EXPORT_ALPHABET.indexOf(char);
      if (value < 0) {
        throw new Error(`invalid export character "${char}"`);
      }
      return value;
    });
  }

  extractValue(bitWidth: number): number {
    let value = 0;
    for (let bitIndex = 0; bitIndex < bitWidth; bitIndex++) {
      const charIndex = Math.floor(this.bitHead / 6);
      if (charIndex >= this.values.length) {
        throw new Error("unexpected end of export");
      }
      const offset = this.bitHead % 6;
      value |= ((this.values[charIndex] >> offset) & 1) << bitIndex;
      this.bitHead++;
    }
    return value;
  }
}
