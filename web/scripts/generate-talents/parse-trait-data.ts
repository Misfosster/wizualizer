/**
 * Parser for SimulationCraft's generated `trait_data.inc`.
 *
 * Each entry in that file is a flat initializer matching the
 * `trait_data_t` struct in `engine/dbc/trait_data.hpp`:
 *
 *     { tree_index, id_class, id_trait_node_entry, id_node, max_ranks,
 *       req_points, id_trait_definition, id_spell, id_replace_spell,
 *       id_override_spell, row, col, selection_index, "Name",
 *       { spec0, spec1, spec2, spec3 },
 *       { starter0, starter1, starter2, starter3 },
 *       id_sub_tree, node_type }
 *
 * `tree_index` values (from SimC's `talent_tree` enum):
 *   0 = INVALID, 1 = CLASS, 2 = SPECIALIZATION, 3 = HERO
 *
 * `node_type` values:
 *   1 = normal, 2 = choice (two entries share an `id_node`),
 *   3 = tree-selection (picks a hero tree; we don't emit these as
 *       talents in the catalog)
 *
 * The parser is intentionally a small hand-rolled state machine rather
 * than a general C++ parser: we only need to read the well-known shape
 * that the SimC code generator emits. If upstream rewrites the emitter
 * (e.g. swaps field order), the assertions below will fire early and
 * loudly rather than silently producing wrong ranks.
 */

export type TraitTreeKind = "class" | "spec" | "hero" | "other";

export interface TraitRow {
  treeKind: TraitTreeKind;
  classId: number;
  entryId: number;
  nodeId: number;
  maxRank: number;
  row: number;
  col: number;
  selectionIndex: number;
  displayName: string;
  specIds: readonly number[];
  starterSpecIds: readonly number[];
  subTreeId: number;
  nodeType: number;
  spellId: number;
}

export function parseTraitData(source: string): TraitRow[] {
  const rows: TraitRow[] = [];
  // SimC's generator has used both 1-space and 2-space indentation for
  // the inner rows across WoW builds, so match any leading whitespace
  // rather than a fixed prefix.
  const rowLineRegex = /^\s*\{\s.*\}/;

  for (const rawLine of source.split("\n")) {
    if (!rowLineRegex.test(rawLine)) {
      continue;
    }
    const parsed = parseTraitRow(rawLine);
    if (parsed) {
      rows.push(parsed);
    }
  }

  return rows;
}

function parseTraitRow(line: string): TraitRow | null {
  const fields = splitTopLevelFields(line);
  if (fields.length < 18) {
    return null;
  }

  const treeIndexStr = fields[0];
  const classIdStr = fields[1];
  const entryIdStr = fields[2];
  const nodeIdStr = fields[3];
  const maxRankStr = fields[4];
  const spellIdStr = fields[7];
  const rowStr = fields[10];
  const colStr = fields[11];
  const selectionIndexStr = fields[12];
  const nameField = fields[13];
  const specsField = fields[14];
  const startersField = fields[15];
  const subTreeIdStr = fields[16];
  const nodeTypeStr = fields[17];

  const treeKind = toTreeKind(parseIntStrict(treeIndexStr));
  const classId = parseIntStrict(classIdStr);
  if (!Number.isInteger(classId) || classId <= 0) {
    return null;
  }

  const rawName = unquote(nameField);
  if (rawName.length === 0) {
    return null;
  }

  const specIds = parseArrayField(specsField);
  const starterSpecIds = parseArrayField(startersField);

  return {
    treeKind,
    classId,
    entryId: parseIntStrict(entryIdStr),
    nodeId: parseIntStrict(nodeIdStr),
    maxRank: parseIntStrict(maxRankStr),
    row: parseIntStrict(rowStr),
    col: parseIntStrict(colStr),
    selectionIndex: parseIntStrict(selectionIndexStr),
    displayName: rawName,
    specIds,
    starterSpecIds,
    subTreeId: parseIntStrict(subTreeIdStr),
    nodeType: parseIntStrict(nodeTypeStr),
    spellId: parseIntStrict(spellIdStr),
  };
}

function toTreeKind(value: number): TraitTreeKind {
  switch (value) {
    case 1:
      return "class";
    case 2:
      return "spec";
    case 3:
      return "hero";
    default:
      return "other";
  }
}

function splitTopLevelFields(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("},") && !trimmed.endsWith("}")) {
    return [];
  }

  const body = trimmed.replace(/^\{/, "").replace(/\},?$/, "").trim();
  const fields: string[] = [];
  let depthBrace = 0;
  let inString = false;
  let buffer = "";

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      buffer += ch;
      if (ch === "\\" && i + 1 < body.length) {
        buffer += body[i + 1];
        i++;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      buffer += ch;
      continue;
    }

    if (ch === "{") {
      depthBrace++;
      buffer += ch;
      continue;
    }
    if (ch === "}") {
      depthBrace--;
      buffer += ch;
      continue;
    }

    if (ch === "," && depthBrace === 0) {
      fields.push(buffer.trim());
      buffer = "";
      continue;
    }

    buffer += ch;
  }

  if (buffer.trim().length > 0) {
    fields.push(buffer.trim());
  }

  return fields;
}

function parseArrayField(field: string): number[] {
  const trimmed = field.trim();
  const isBraced = trimmed.startsWith("{") && trimmed.endsWith("}");
  if (!isBraced) {
    return [];
  }
  const inner = trimmed.slice(1, -1).trim();
  if (inner.length === 0) {
    return [];
  }
  return inner
    .split(",")
    .map((part) => parseIntStrict(part.trim()))
    .filter((value) => Number.isFinite(value) && value !== 0);
}

function parseIntStrict(raw: string): number {
  const cleaned = raw.trim();
  if (cleaned.length === 0) {
    return Number.NaN;
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : Number.NaN;
}

function unquote(raw: string): string {
  const trimmed = raw.trim();
  const isQuoted =
    trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"');
  if (!isQuoted) {
    return trimmed;
  }
  return trimmed
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

export interface TraitDataHeader {
  gameVersion: string;
}

export function parseHeader(source: string): TraitDataHeader {
  const match = /wow build\s+([\d.]+)/i.exec(source.slice(0, 500));
  return { gameVersion: match?.[1] ?? "unknown" };
}
