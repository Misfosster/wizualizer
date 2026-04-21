import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  TalentCatalog,
  TalentSpecCatalog,
  TalentStreamNode,
} from "../../../src/utils/talents/types";

const EXPORT_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export const MIDNIGHT_ENHANCEMENT_TOTEMIC_EXPORT =
  "CcQAAAAAAAAAAAAAAAAAAAAAAMzMjZmZmZmZmZmZmZGAAAAAAAAAYB2gZsox2AYmgNAsMjZMWWmBmZ2GLzMzMMWGzAAYAGzMxMDAMGA";

export const MIDNIGHT_ENHANCEMENT_STORMBRINGER_EXPORT =
  "CcQAAAAAAAAAAAAAAAAAAAAAAMzMzwMzMzMzMzMzMzAAAAAAAAAsBYzMG2ILwMM0gFAmlZMzMWWmBmZ2YZmZmhhxMAAzwwwMTgZGMYcBA";

export interface EncodeTalentExportOptions {
  selectedRanks?: Readonly<Record<string, number>>;
  selectedSubTrees?: readonly number[];
}

export function loadTalentSpecCatalog(
  classSlug: string,
  specSlug: string,
): TalentSpecCatalog {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const path = resolve(root, "src", "data", "talents", `${classSlug}.json`);
  const catalog = JSON.parse(readFileSync(path, "utf8")) as TalentCatalog;
  const key = `${classSlug}/${specSlug}`;
  const spec = (catalog.byClassSpec as Partial<Record<string, TalentSpecCatalog>>)[key];
  if (spec === undefined) {
    throw new Error(`missing talent catalog for ${key}`);
  }
  return spec;
}

export function encodeTalentExport(
  catalog: TalentSpecCatalog,
  options: EncodeTalentExportOptions = {},
): string {
  const writer = new ExportDataStream();
  const selectedRanks = options.selectedRanks ?? {};
  const selectedSubTrees = new Set(options.selectedSubTrees ?? []);

  writer.addValue(8, 2);
  writer.addValue(16, catalog.specId);
  for (let i = 0; i < 16; i++) {
    writer.addValue(8, 0);
  }

  for (const node of getStreamNodes(catalog)) {
    const encoded = encodeNode(node, selectedRanks, selectedSubTrees);
    writer.addValue(1, encoded.selected ? 1 : 0);
    if (!encoded.selected) {
      continue;
    }

    writer.addValue(1, encoded.purchased ? 1 : 0);
    if (!encoded.purchased) {
      continue;
    }

    const fullRank = node.maxRank > 0 ? node.maxRank : 1;
    const isPartial = encoded.rank !== fullRank;
    writer.addValue(1, isPartial ? 1 : 0);
    if (isPartial) {
      writer.addValue(6, encoded.rank);
    }

    writer.addValue(1, encoded.choiceIndex === null ? 0 : 1);
    if (encoded.choiceIndex !== null) {
      writer.addValue(2, encoded.choiceIndex);
    }
  }

  return writer.toExportString();
}

function getStreamNodes(catalog: TalentSpecCatalog): readonly TalentStreamNode[] {
  if (!catalog.streamNodes || catalog.streamNodes.length === 0) {
    throw new Error("catalog is missing streamNodes");
  }
  return catalog.streamNodes;
}

function encodeNode(
  node: TalentStreamNode,
  selectedRanks: Readonly<Record<string, number>>,
  selectedSubTrees: ReadonlySet<number>,
): {
  selected: boolean;
  purchased: boolean;
  rank: number;
  choiceIndex: number | null;
} {
  if (node.nodeType === "subtree_selection") {
    const explicitIndex = node.entries.findIndex((entry) =>
      typeof entry.subTreeId === "number" && selectedSubTrees.has(entry.subTreeId),
    );
    if (explicitIndex < 0) {
      return {
        selected: false,
        purchased: false,
        rank: 0,
        choiceIndex: null,
      };
    }
    return {
      selected: true,
      purchased: true,
      rank: node.maxRank > 0 ? node.maxRank : 1,
      choiceIndex: explicitIndex,
    };
  }

  const purchasedChoiceIndex = node.entries.findIndex((entry) => {
    const key = entry.simcKey;
    return typeof key === "string" && (selectedRanks[key] ?? 0) > 0;
  });

  if (purchasedChoiceIndex >= 0) {
    const entry = node.entries[purchasedChoiceIndex];
    const simcKey = entry.simcKey;
    if (simcKey === undefined) {
      throw new Error(`purchased node ${String(node.nodeId)} is missing simcKey`);
    }
    const rank = Math.max(1, selectedRanks[simcKey] ?? 1);
    return {
      selected: true,
      purchased: true,
      rank,
      choiceIndex: node.nodeType === "choice" ? purchasedChoiceIndex : null,
    };
  }

  if (node.grantedRanks > 0) {
    return {
      selected: true,
      purchased: false,
      rank: node.grantedRanks,
      choiceIndex: null,
    };
  }

  return {
    selected: false,
    purchased: false,
    rank: 0,
    choiceIndex: null,
  };
}

class ExportDataStream {
  private values: number[] = [0];
  private currentBitIndex = 0;
  private currentCharIndex = 0;

  addValue(bitWidth: number, value: number): void {
    for (let i = 0; i < bitWidth; i++) {
      const bit = (value & (1 << i)) >> i;
      this.values[this.currentCharIndex] |= bit << this.currentBitIndex;
      this.currentBitIndex++;
      if (this.currentBitIndex === 6) {
        this.currentBitIndex = 0;
        this.currentCharIndex++;
        this.values[this.currentCharIndex] = 0;
      }
    }
  }

  toExportString(): string {
    let lastIndex = this.values.length - 1;
    while (lastIndex > 0 && this.values[lastIndex] === 0) {
      lastIndex--;
    }
    let output = "";
    for (let i = 0; i <= lastIndex; i++) {
      output += EXPORT_ALPHABET[this.values[i] ?? 0];
    }
    return output;
  }
}
