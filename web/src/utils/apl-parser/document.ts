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
// copy="Name" starts a new profile that inherits from the previous one
const COPY_PROFILE_RE = /^copy="([^"]+)"$/;
// We only care about lines that start with actions — everything else (gear, config, etc.) is skipped
const ACTION_LINE_RE = /^actions(?:\.|=|\+=\/)/;

export interface ParsedActionLine {
  action: Action;
  rawLine: string;
  lineNumber: number;
}

export interface AplBlock {
  name: string;
  actions: ParsedActionLine[];
}

export interface AplProfile {
  name: string;
  className: string;
  blocks: AplBlock[];
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

function createProfile(name: string, className: string): AplProfile {
  return { name, className, blocks: [] };
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

  return createProfile(profileName, className);
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
  return createProfile(profileName, className);
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
      blocksByName = new Map<string, AplBlock>();
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
    block.actions.push(parsedActionLine);
  }

  return { ok: true, document };
}
