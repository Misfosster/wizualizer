import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  TalentChoiceVariant,
  TalentNodeEntry,
  TalentSpecCatalog,
} from "../../src/utils/talents/types";
import { simmifyTalentName } from "../../src/utils/talents/simc-key";
import {
  CLASS_TABLE,
  findClassById,
  findSpecById,
  specsForClass,
} from "./class-spec-registry";
import type { TraitRow } from "./parse-trait-data";

/**
 * Group rows from `parseTraitData` into per-class JSON catalogs and
 * write them to `web/src/data/talents/`.
 *
 * Per-class file shape matches `TalentCatalog` with a single class in
 * `byClassSpec`, so the runtime loader can dynamic-import one file per
 * class and keep the initial bundle small.
 */

export interface EmitCatalogOptions {
  outDir: string;
  gameVersion: string;
}

export interface EmitCatalogResult {
  gameVersion: string;
  classesWritten: string[];
  specCount: number;
  nodeCount: number;
  warnings: readonly string[];
}

interface NodeBucket {
  nodeId: number;
  row: number;
  col: number;
  maxRank: number;
  entries: TraitRow[];
}

export function emitCatalog(
  rows: readonly TraitRow[],
  options: EmitCatalogOptions,
): EmitCatalogResult {
  rmSync(options.outDir, { recursive: true, force: true });
  mkdirSync(options.outDir, { recursive: true });

  const warnings: string[] = [];
  const classesWritten: string[] = [];
  let specCount = 0;
  let nodeCount = 0;

  for (const classEntry of CLASS_TABLE) {
    const classRows = rows.filter((row) => row.classId === classEntry.id);
    if (classRows.length === 0) {
      continue;
    }

    const specs = specsForClass(classEntry.slug);
    const byClassSpec: Record<string, TalentSpecCatalog> = {};

    for (const specEntry of specs) {
      const { catalog, nodes } = buildSpecCatalog(classRows, specEntry.id, warnings);
      const key = `${classEntry.slug}/${specEntry.slug}`;
      byClassSpec[key] = catalog;
      specCount++;
      nodeCount += nodes;
    }

    if (Object.keys(byClassSpec).length === 0) {
      continue;
    }

    const file = join(options.outDir, `${classEntry.slug}.json`);
    writeFileSync(
      file,
      `${JSON.stringify({ gameVersion: options.gameVersion, byClassSpec }, null, 2)}\n`,
      "utf8",
    );
    classesWritten.push(classEntry.slug);
  }

  const indexPath = join(options.outDir, "index.json");
  writeFileSync(
    indexPath,
    `${JSON.stringify(
      { gameVersion: options.gameVersion, classes: classesWritten },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const strayClassIds = collectStrayClassIds(rows);
  for (const id of strayClassIds) {
    warnings.push(`trait row referenced unknown class id ${String(id)}`);
  }

  return {
    gameVersion: options.gameVersion,
    classesWritten,
    specCount,
    nodeCount,
    warnings,
  };
}

interface SpecBuildResult {
  catalog: TalentSpecCatalog;
  nodes: number;
}

function buildSpecCatalog(
  classRows: readonly TraitRow[],
  specId: number,
  warnings: string[],
): SpecBuildResult {
  const classNodes = collectTreeNodes(classRows, "class", specId);
  const specNodes = collectTreeNodes(classRows, "spec", specId);
  const heroNodes = collectTreeNodes(classRows, "hero", specId);

  const classInfo = findClassById(classRows[0]?.classId ?? 0);
  const specInfo = findSpecById(specId);
  if (!classInfo || !specInfo) {
    warnings.push(
      `cannot resolve class/spec pair for specId=${String(specId)}`,
    );
  }

  const catalog: TalentSpecCatalog = {
    classId: classInfo?.id ?? 0,
    specId,
    treeHash: "",
    classNodes,
    specNodes,
    ...(heroNodes.length > 0 ? { heroNodes } : {}),
  };

  return {
    catalog,
    nodes: classNodes.length + specNodes.length + heroNodes.length,
  };
}

function collectTreeNodes(
  classRows: readonly TraitRow[],
  kind: "class" | "spec" | "hero",
  specId: number,
): TalentNodeEntry[] {
  const filtered = classRows.filter((row) => {
    if (row.treeKind !== kind) {
      return false;
    }
    // node_type 3 = tree-selection (picks which hero tree is active).
    // These are not talents players spend points on and have no SimC
    // key, so omit them from the catalog entirely.
    if (row.nodeType === 3) {
      return false;
    }
    if (kind === "class") {
      return isEligibleForSpec(row, specId);
    }
    if (kind === "spec") {
      return row.specIds.includes(specId);
    }
    return isHeroNodeForSpec(row, specId);
  });

  const buckets = groupByNodeId(filtered);

  return Array.from(buckets.values())
    .map((bucket): TalentNodeEntry => toTalentNodeEntry(bucket))
    .sort(compareNodePlacement);
}

function isEligibleForSpec(row: TraitRow, specId: number): boolean {
  if (row.specIds.length === 0) {
    return true;
  }
  return row.specIds.includes(specId);
}

function isHeroNodeForSpec(row: TraitRow, specId: number): boolean {
  if (row.subTreeId === 0) {
    return false;
  }
  if (row.specIds.length === 0) {
    return true;
  }
  return row.specIds.includes(specId);
}

function groupByNodeId(rows: readonly TraitRow[]): Map<number, NodeBucket> {
  const buckets = new Map<number, NodeBucket>();
  for (const row of rows) {
    const existing = buckets.get(row.nodeId);
    if (existing) {
      existing.entries.push(row);
      continue;
    }
    buckets.set(row.nodeId, {
      nodeId: row.nodeId,
      row: row.row,
      col: row.col,
      maxRank: 0,
      entries: [row],
    });
  }
  return buckets;
}

function toTalentNodeEntry(bucket: NodeBucket): TalentNodeEntry {
  const sorted = sortChoiceEntries(bucket.entries);
  const primary = sorted[0];
  const placement: Pick<TalentNodeEntry, "row" | "col"> = {
    ...(bucket.row > 0 ? { row: bucket.row } : {}),
    ...(bucket.col > 0 ? { col: bucket.col } : {}),
  };

  // node_type === 2 means the player picks one of several variants
  // that all live under the same node_id. Only this shape is a true
  // choice; other multi-row buckets (e.g. "staged" talents like Storm
  // Unleashed, where three rows all share the same display name and
  // contribute additive ranks) collapse into a single normal entry.
  const isChoice =
    sorted.length > 1 && sorted.every((row) => row.nodeType === 2);

  if (!isChoice) {
    const maxRank = computeNormalMaxRank(sorted);
    return {
      talentId: primary.entryId,
      displayName: primary.displayName,
      simcKey: simmifyTalentName(primary.displayName),
      maxRank,
      ...placement,
      nodeType: "normal",
    };
  }

  const choices: TalentChoiceVariant[] = sorted.map((row) => ({
    talentId: row.entryId,
    displayName: row.displayName,
    simcKey: simmifyTalentName(row.displayName),
  }));

  // For choice nodes every variant shares the same rank budget; any
  // single row's max_rank is representative.
  const choiceMaxRank = primary.maxRank > 0 ? primary.maxRank : 1;

  return {
    talentId: primary.entryId,
    displayName: primary.displayName,
    simcKey: simmifyTalentName(primary.displayName),
    maxRank: choiceMaxRank,
    ...placement,
    nodeType: "choice",
    choices,
  };
}

function computeNormalMaxRank(entries: readonly TraitRow[]): number {
  // Single-row nodes use their own max_rank. Staged-rank nodes split a
  // talent across multiple rows (each encoding one upgrade tier), so we
  // sum their individual max_ranks to get the total points a player can
  // invest in the named talent.
  if (entries.length === 1) {
    return entries[0].maxRank > 0 ? entries[0].maxRank : 1;
  }
  const total = entries.reduce((sum, entry) => sum + Math.max(entry.maxRank, 0), 0);
  return total > 0 ? total : 1;
}

function sortChoiceEntries(entries: readonly TraitRow[]): TraitRow[] {
  return [...entries].sort((a, b) => {
    if (b.selectionIndex !== a.selectionIndex) {
      return b.selectionIndex - a.selectionIndex;
    }
    return a.entryId - b.entryId;
  });
}

function compareNodePlacement(
  a: TalentNodeEntry,
  b: TalentNodeEntry,
): number {
  const rowA = a.row ?? 99;
  const rowB = b.row ?? 99;
  if (rowA !== rowB) {
    return rowA - rowB;
  }
  const colA = a.col ?? 99;
  const colB = b.col ?? 99;
  if (colA !== colB) {
    return colA - colB;
  }
  return a.talentId - b.talentId;
}

function collectStrayClassIds(rows: readonly TraitRow[]): number[] {
  const seen = new Set<number>();
  for (const row of rows) {
    if (!findClassById(row.classId)) {
      seen.add(row.classId);
    }
  }
  return Array.from(seen).sort((a, b) => a - b);
}
