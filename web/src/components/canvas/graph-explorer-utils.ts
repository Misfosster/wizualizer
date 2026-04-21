import { getConditionSegments } from "@/utils/apl-parser/action-data";
import { prettyCond } from "@/utils/apl-parser/pretty-log";
import type { ParsedActionLine } from "@/utils/apl-parser/document";

export interface FilteredProfile {
  profileIndex: number;
  profileName: string;
  blocks: FilteredBlock[];
}

export interface FilteredBlock {
  blockName: string;
  actions: FilteredAction[];
}

export interface FilteredAction {
  actionIndex: number;
  actionLine: ParsedActionLine;
}

export function filterProfiles(
  profiles: readonly {
    name: string;
    blocks: readonly {
      name: string;
      actions: readonly ParsedActionLine[];
    }[];
  }[],
  query: string,
): FilteredProfile[] {
  return profiles.flatMap((profile, profileIndex) => {
    const profileMatch = query.length === 0 || profile.name.toLowerCase().includes(query);
    const filteredBlocks = profile.blocks.flatMap((block) => {
      const blockMatch = query.length === 0 || block.name.toLowerCase().includes(query);
      const filteredActions = block.actions.flatMap((actionLine, actionIndex) => {
        if (profileMatch || blockMatch || actionMatchesQuery(actionLine, query)) {
          return [{ actionIndex, actionLine }];
        }
        return [];
      });
      return filteredActions.length > 0
        ? [{ blockName: block.name, actions: filteredActions }]
        : [];
    });
    return filteredBlocks.length > 0
      ? [{ profileIndex, profileName: profile.name, blocks: filteredBlocks }]
      : [];
  });
}

export function replaceLineAt(text: string, lineNumber: number, nextLine: string): string {
  const lines = text.split(/\r?\n/);
  const lineIndex = lineNumber - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return text;
  }
  lines[lineIndex] = nextLine;
  return lines.join("\n");
}

export function moveLine(
  text: string,
  sourceLine: number,
  targetLine: number,
  placement: "before" | "after",
): string {
  const lines = text.split(/\r?\n/);
  const sourceIndex = sourceLine - 1;
  const targetIndex = targetLine - 1;
  if (
    sourceIndex < 0 ||
    sourceIndex >= lines.length ||
    targetIndex < 0 ||
    targetIndex >= lines.length ||
    sourceIndex === targetIndex
  ) {
    return text;
  }

  const [line] = lines.splice(sourceIndex, 1);
  let insertIndex = targetIndex;
  if (sourceIndex < targetIndex) {
    insertIndex -= 1;
  }
  if (placement === "after") {
    insertIndex += 1;
  }
  insertIndex = Math.max(0, Math.min(insertIndex, lines.length));
  lines.splice(insertIndex, 0, line);
  return lines.join("\n");
}

export function leadingWhitespace(value: string): string {
  const match = /^\s*/.exec(value);
  return match?.[0] ?? "";
}

function actionMatchesQuery(actionLine: ParsedActionLine, query: string): boolean {
  if (!query) {
    return true;
  }
  const conditionText = getConditionSegments(actionLine.action.segments)
    .map((segment) => prettyCond(segment.expr))
    .join(" ");
  const haystack = `${actionLine.action.spell} ${actionLine.rawLine} ${conditionText}`.toLowerCase();
  return haystack.includes(query);
}
