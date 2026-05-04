import type { AplDocument, ParsedActionLine } from "./document";
import {
  getActionNodeId,
  getBlockNodeId,
  getRootNodeId,
} from "./node-ids";

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
const PROFILE_NAME_RE_SOURCE = String.raw`(?:"[^"]+"|\S+)`;
const CLASS_PROFILE_RE = new RegExp(
  `^(?:${CLASS_KEYWORDS.join("|")})=${PROFILE_NAME_RE_SOURCE}$`,
);
const COPY_PROFILE_RE = new RegExp(`^copy=${PROFILE_NAME_RE_SOURCE}$`);
const PROFILE_METADATA_RE = /^(?:spec|talents)=\S+$/;
const ACTION_LINE_RE = /^actions(?:\.[A-Za-z0-9_.-]*)?(?=$|[=+/])/;

interface ActionSourceMatch {
  profileIndex: number;
  blockName: string;
  actionIndex: number;
  line: ParsedActionLine;
}

function isProfileStart(line: string): boolean {
  return CLASS_PROFILE_RE.test(line) || COPY_PROFILE_RE.test(line);
}

function getExplicitProfileIndexAtLine(
  lines: readonly string[],
  lineNumber: number,
  profileCount: number,
): number | null {
  let profileIndex: number | null = null;

  for (let index = 0; index < Math.min(lineNumber, lines.length); index++) {
    const line = (lines[index] ?? "").trim();
    if (isProfileStart(line)) {
      profileIndex = Math.min((profileIndex ?? -1) + 1, profileCount - 1);
    }

    if (index + 1 === lineNumber) {
      break;
    }

    if (
      profileIndex === null &&
      (ACTION_LINE_RE.test(line) || PROFILE_METADATA_RE.test(line))
    ) {
      profileIndex = 0;
    }
  }

  return profileIndex;
}

function getActionSourceMatches(document: AplDocument): ActionSourceMatch[] {
  const matches: ActionSourceMatch[] = [];

  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    const profile = document.profiles[profileIndex];

    for (const block of profile.blocks) {
      for (let actionIndex = 0; actionIndex < block.actions.length; actionIndex++) {
        const line = block.actions[actionIndex];
        if (line.isInherited) {
          continue;
        }
        matches.push({
          profileIndex,
          blockName: block.name,
          actionIndex,
          line,
        });
      }
    }
  }

  return matches;
}

function findNearestActionInProfile(
  matches: readonly ActionSourceMatch[],
  profileIndex: number,
  lineNumber: number,
): ActionSourceMatch | null {
  let nearest: ActionSourceMatch | null = null;

  for (const match of matches) {
    if (
      match.profileIndex !== profileIndex ||
      match.line.lineNumber > lineNumber
    ) {
      continue;
    }
    if (!nearest || nearest.line.lineNumber < match.line.lineNumber) {
      nearest = match;
    }
  }

  return nearest;
}

export function getGraphNodeIdForSourceLine(
  document: AplDocument | null,
  text: string,
  lineNumber: number,
  collapsedBlocks: ReadonlySet<string> = new Set<string>(),
): string | null {
  if (!document || document.profiles.length === 0) {
    return null;
  }

  const matches = getActionSourceMatches(document);
  const exactAction = matches.find((match) => match.line.lineNumber === lineNumber);
  if (exactAction) {
    const blockId = getBlockNodeId(exactAction.profileIndex, exactAction.blockName);
    if (collapsedBlocks.has(blockId)) {
      return blockId;
    }
    return getActionNodeId(
      exactAction.profileIndex,
      exactAction.blockName,
      exactAction.actionIndex,
    );
  }

  const lines = text.split(/\r?\n/);
  const profileIndex = getExplicitProfileIndexAtLine(
    lines,
    Math.max(1, lineNumber),
    document.profiles.length,
  );
  if (profileIndex === null) {
    return null;
  }

  const line = (lines[lineNumber - 1] ?? "").trim();
  if (isProfileStart(line) || PROFILE_METADATA_RE.test(line)) {
    return getRootNodeId(profileIndex);
  }

  const nearestAction = findNearestActionInProfile(
    matches,
    profileIndex,
    lineNumber,
  );
  if (!nearestAction) {
    return getRootNodeId(profileIndex);
  }

  const blockId = getBlockNodeId(
    nearestAction.profileIndex,
    nearestAction.blockName,
  );
  return collapsedBlocks.has(blockId)
    ? blockId
    : getActionNodeId(
        nearestAction.profileIndex,
        nearestAction.blockName,
        nearestAction.actionIndex,
      );
}

export function getGraphNodeIdForSourceViewport(
  document: AplDocument | null,
  text: string,
  fromLineNumber: number,
  toLineNumber: number,
  collapsedBlocks: ReadonlySet<string> = new Set<string>(),
): string | null {
  const from = Math.max(1, fromLineNumber);
  if (from <= 1) {
    return null;
  }

  const lines = text.split(/\r?\n/);
  const to = Math.min(Math.max(from, toLineNumber), lines.length);
  for (let lineNumber = from; lineNumber <= to; lineNumber++) {
    if (isProfileStart((lines[lineNumber - 1] ?? "").trim())) {
      return getGraphNodeIdForSourceLine(
        document,
        text,
        lineNumber,
        collapsedBlocks,
      );
    }
  }

  return getGraphNodeIdForSourceLine(document, text, from, collapsedBlocks);
}
