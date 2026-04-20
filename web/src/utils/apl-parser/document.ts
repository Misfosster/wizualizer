import { parseAction } from "./parser";
import type { Action } from "./types";

const CLASS_KEYWORDS = [
  "warrior",
  "paladin",
  "hunter",
  "rogue",
  "priest",
  "deathknight",
  "shaman",
  "mage",
  "warlock",
  "monk",
  "druid",
  "demonhunter",
  "evoker",
] as const;

// e.g. shaman="MyProfile", mage="Fire Mage", etc.
const CLASS_PROFILE_RE = new RegExp(
  `^(${CLASS_KEYWORDS.join("|")})="([^"]+)"$`,
);
// copy="Name" starts a new profile cloned from the previous one
const COPY_PROFILE_RE = /^copy="([^"]+)"$/;
// spec=<spec_name>, e.g. spec=enhancement
const SPEC_LINE_RE = /^spec=(\S+)$/;
// talents=<export_string>, e.g. talents=CIcAAAAA...
const TALENTS_LINE_RE = /^talents=(\S+)$/;
// Temporary scope boundary: graph building currently understands action lines.
// Gear/config lines should be equally important parsed document data later.
// For now they pass through untouched, while malformed action-like lines still
// reach the parser so validation can report them.
const ACTION_LINE_RE = /^actions(?:\.[A-Za-z0-9_.-]*)?(?=$|[=+/])/;

export interface ParsedActionLine {
  action: Action;
  rawLine: string;
  lineNumber: number;
  /**
   * True when this line was inherited from a previous profile via `copy=`.
   * It does not map to a concrete line owned by the current profile.
   */
  isInherited?: boolean;
}

export interface AplBlock {
  name: string;
  actions: ParsedActionLine[];
}

export interface AplProfile {
  name: string;
  className: string;
  isCopy?: boolean;
  blocks: AplBlock[];
  // Free-form syntactic metadata captured from SimC profile lines. Decoded
  // talent selections live in derived editor state, not here.
  specName?: string;
  talentExport?: string;
}

export interface AplDocument {
  profiles: AplProfile[];
}

interface ParseDocumentFailure {
  ok: false;
  error: string;
  lineNumber: number;
  lineText: string;
}

export type ParseDocumentResult =
  | { ok: true; document: AplDocument }
  | ParseDocumentFailure;

function createProfile(
  name: string,
  className: string,
  isCopy: boolean = false,
): AplProfile {
  return { name, className, isCopy, blocks: [] };
}

function parseProfileDefinition(line: string): AplProfile | null {
  const match = CLASS_PROFILE_RE.exec(line);
  if (!match) {
    return null;
  }

  const className = match[1];
  const profileName = match[2];
  if (!className || !profileName) {
    return null;
  }

  return createProfile(profileName, className, false);
}

function parseCopyDefinition(
  line: string,
  previousProfile: AplProfile | null,
): AplProfile | null {
  const match = COPY_PROFILE_RE.exec(line);
  const profileName = match?.[1];
  if (!profileName) {
    return null;
  }

  const className = previousProfile?.className ?? "unknown";
  const profile = createProfile(profileName, className, true);
  if (previousProfile) {
    profile.blocks = cloneBlocks(previousProfile.blocks);
  }
  // Snapshot syntactic metadata by value. Later spec=/talents= lines on the
  // copy override only the copy; the source profile is unaffected.
  if (previousProfile?.specName !== undefined) {
    profile.specName = previousProfile.specName;
  }
  if (previousProfile?.talentExport !== undefined) {
    profile.talentExport = previousProfile.talentExport;
  }
  return profile;
}

function ensureProfile(
  currentProfile: AplProfile | null,
  profiles: AplProfile[],
): AplProfile {
  if (currentProfile) {
    return currentProfile;
  }

  const defaultProfile = createProfile("Untitled", "unknown");
  profiles.push(defaultProfile);
  return defaultProfile;
}

// Returns true when the line was recognized as profile metadata (spec=, talents=)
// and applied to the current profile. Implicitly creates a default profile when
// metadata appears before any class profile line, so the data is not silently
// dropped.
function applyProfileMetadata(
  line: string,
  currentProfile: AplProfile | null,
  profiles: AplProfile[],
): boolean {
  const specMatch = SPEC_LINE_RE.exec(line);
  if (specMatch) {
    const profile = ensureProfile(currentProfile, profiles);
    profile.specName = specMatch[1];
    return true;
  }

  const talentsMatch = TALENTS_LINE_RE.exec(line);
  if (talentsMatch) {
    const profile = ensureProfile(currentProfile, profiles);
    profile.talentExport = talentsMatch[1];
    return true;
  }

  return false;
}

function cloneBlocks(blocks: readonly AplBlock[]): AplBlock[] {
  return blocks.map((block) => ({
    name: block.name,
    actions: block.actions.map((line) => ({
      action: line.action,
      rawLine: line.rawLine,
      lineNumber: line.lineNumber,
      isInherited: true,
    })),
  }));
}

function buildBlockIndex(blocks: readonly AplBlock[]): Map<string, AplBlock> {
  const byName = new Map<string, AplBlock>();
  for (const block of blocks) {
    byName.set(block.name, block);
  }
  return byName;
}

function getOrCreateBlock(
  blocksByName: Map<string, AplBlock>,
  profile: AplProfile,
  blockName: string,
): AplBlock {
  const existingBlock = blocksByName.get(blockName);
  if (existingBlock) {
    return existingBlock;
  }

  const block: AplBlock = { name: blockName, actions: [] };
  blocksByName.set(blockName, block);
  profile.blocks.push(block);
  return block;
}

function applyActionToBlock(block: AplBlock, actionLine: ParsedActionLine): void {
  // SimC semantics: `actions.foo=...` replaces the list, while
  // `actions.foo+=/...` appends to the existing list.
  if (actionLine.action.op === "=") {
    block.actions = [actionLine];
    return;
  }
  block.actions.push(actionLine);
}

function parseActionLine(
  rawLine: string,
  lineNumber: number,
): ParsedActionLine | ParseDocumentFailure {
  const line = rawLine.trim();

  try {
    const action = parseAction(line);
    if (!action) {
      return {
        ok: false,
        error: "Expected an action line, but nothing was parsed",
        lineNumber,
        lineText: rawLine,
      };
    }

    return { action, rawLine, lineNumber };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message, lineNumber, lineText: rawLine };
  }
}

// A successful parse has no "ok" field, so if we see one it must be a failure
function isParseFailure(
  value: ParsedActionLine | ParseDocumentFailure,
): value is ParseDocumentFailure {
  return "ok" in value && !value.ok;
}

export function parseDocument(text: string): ParseDocumentResult {
  const document: AplDocument = { profiles: [] };
  let currentProfile: AplProfile | null = null;
  let blocksByName = new Map<string, AplBlock>();

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const definedProfile = parseProfileDefinition(line);
    if (definedProfile) {
      currentProfile = definedProfile;
      document.profiles.push(currentProfile);
      blocksByName = new Map<string, AplBlock>();
      continue;
    }

    const copiedProfile = parseCopyDefinition(
      line,
      document.profiles[document.profiles.length - 1] ?? null,
    );
    if (copiedProfile) {
      currentProfile = copiedProfile;
      document.profiles.push(currentProfile);
      blocksByName = buildBlockIndex(currentProfile.blocks);
      continue;
    }

    if (applyProfileMetadata(line, currentProfile, document.profiles)) {
      // Metadata may have implicitly created the default profile.
      currentProfile = document.profiles[document.profiles.length - 1] ?? null;
      continue;
    }

    if (!ACTION_LINE_RE.test(line)) {
      continue;
    }

    currentProfile = ensureProfile(currentProfile, document.profiles);
    const parsedActionLine = parseActionLine(rawLine, index + 1);
    if (isParseFailure(parsedActionLine)) {
      return parsedActionLine;
    }

    const block = getOrCreateBlock(
      blocksByName,
      currentProfile,
      parsedActionLine.action.category,
    );
    applyActionToBlock(block, parsedActionLine);
  }

  return { ok: true, document };
}
