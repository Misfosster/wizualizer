import { useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/state/editorStore";
import { getConditionSegments } from "@/utils/apl-parser/action-data";
import { getActionNodeId } from "@/utils/apl-parser/node-ids";
import { prettyCond } from "@/utils/apl-parser/pretty-log";
import type { ParsedActionLine } from "@/utils/apl-parser/document";

interface ActionMatch {
  nodeId: string;
  actionLine: ParsedActionLine;
  matchingConditions: string[];
}

interface BlockMatch {
  blockName: string;
  actions: ActionMatch[];
}

interface ProfileMatch {
  profileIndex: number;
  profileName: string;
  blocks: BlockMatch[];
}

const MAX_ACTION_MATCHES = 100;
const SPACE_OR_UNDERSCORE = /[\s_]+/g;

export function GraphSearchBox() {
  const [query, setQuery] = useState("");
  const { document, requestGraphJumpToNode } = useEditorStore(
    useShallow((state) => ({
      document: state.document,
      requestGraphJumpToNode: state.requestGraphJumpToNode,
    })),
  );
  const profiles = document?.profiles ?? [];
  const normalizedQuery = normalizeSearchValue(query);

  const matches = useMemo(
    () => buildTreeMatches(profiles, normalizedQuery, MAX_ACTION_MATCHES),
    [profiles, normalizedQuery],
  );
  const firstMatchNodeId = useMemo(() => {
    for (const profile of matches) {
      for (const block of profile.blocks) {
        const firstAction = block.actions[0];
        if (firstAction) {
          return firstAction.nodeId;
        }
      }
    }
    return null;
  }, [matches]);
  const actionMatchCount = useMemo(
    () =>
      matches.reduce(
        (total, profile) =>
          total + profile.blocks.reduce((sum, block) => sum + block.actions.length, 0),
        0,
      ),
    [matches],
  );

  function jumpToFirst(): void {
    if (!firstMatchNodeId) {
      return;
    }
    requestGraphJumpToNode(firstMatchNodeId);
  }

  return (
    <section className="nodrag nopan w-72 max-w-xs rounded-md border border-gray-300 bg-white/95 p-2 text-gray-700 shadow-sm">
      <header className="mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Search graph
        </h3>
      </header>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              jumpToFirst();
            }
          }}
          placeholder="Search actions, blocks, conditions..."
          className="nodrag nopan w-full rounded border border-gray-300 bg-white py-1 pl-7 pr-7 text-[11px] text-gray-700 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Clear graph search"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {normalizedQuery.length > 0 ? (
        matches.length > 0 ? (
          <>
            <p className="mt-2 text-[10px] text-gray-500">
              {String(actionMatchCount)} matching action{actionMatchCount === 1 ? "" : "s"}
            </p>
          <ul
            className="m-0 mt-1 max-h-52 list-none space-y-2 overflow-y-auto p-0"
            onWheel={(event) => {
              event.stopPropagation();
            }}
          >
            {matches.map((profile) => (
              <li key={`profile:${profile.profileIndex}:${profile.profileName}`} className="rounded border border-gray-200 bg-gray-50/70 p-1.5">
                <p className="text-[11px] font-semibold text-gray-700">
                  profile: {profile.profileName}
                </p>
                <ul className="m-0 mt-1 list-none space-y-1 p-0">
                  {profile.blocks.map((block) => (
                    <li key={`${profile.profileIndex}:${block.blockName}`} className="rounded border border-gray-200 bg-white p-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        block: {block.blockName}
                      </p>
                      <ul className="m-0 mt-1 list-none space-y-1 p-0">
                        {block.actions.map((action) => (
                          <li key={action.nodeId}>
                            <button
                              type="button"
                              onClick={() => {
                                requestGraphJumpToNode(action.nodeId);
                              }}
                              className="flex w-full items-center justify-between rounded border border-gray-200 bg-white px-1.5 py-1 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-mono text-[11px] text-gray-800">
                                  {action.actionLine.action.spell}
                                </span>
                                <span className="block truncate text-[10px] text-gray-500">
                                  line {String(action.actionLine.lineNumber)}
                                </span>
                                {action.matchingConditions.length > 0 ? (
                                  <span className="block truncate text-[10px] text-gray-600">
                                    {action.matchingConditions.join(" | ")}
                                  </span>
                                ) : null}
                              </span>
                              <ChevronRight
                                className="h-3 w-3 shrink-0 text-gray-500"
                                aria-hidden="true"
                              />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          </>
        ) : (
          <p className="mt-2 text-[11px] italic text-gray-500">No matches.</p>
        )
      ) : null}
    </section>
  );
}

function buildTreeMatches(
  profiles: readonly {
    name: string;
    blocks: readonly { name: string; actions: readonly ParsedActionLine[] }[];
  }[],
  query: string,
  maxActions: number,
): ProfileMatch[] {
  if (!query) {
    return [];
  }
  const matches: ProfileMatch[] = [];
  let actionCount = 0;
  for (let profileIndex = 0; profileIndex < profiles.length; profileIndex++) {
    const profile = profiles[profileIndex];
    if (!profile) {
      continue;
    }
    const profileMatch = normalizedIncludes(profile.name, query);
    const blockMatches: BlockMatch[] = [];
    for (const block of profile.blocks) {
      const blockMatch = normalizedIncludes(block.name, query);
      const actionMatches: ActionMatch[] = [];
      for (let actionIndex = 0; actionIndex < block.actions.length; actionIndex++) {
        if (actionCount >= maxActions) {
          break;
        }
        const actionLine = block.actions[actionIndex];
        if (!actionLine) {
          continue;
        }
        const actionText = `${actionLine.action.spell} ${actionLine.rawLine}`;
        const matchingConditions = getConditionSegments(actionLine.action.segments)
          .map((segment) => prettyCond(segment.expr))
          .filter((text) => normalizedIncludes(text, query));
        if (
          profileMatch ||
          blockMatch ||
          normalizedIncludes(actionText, query) ||
          matchingConditions.length > 0
        ) {
          actionMatches.push({
            nodeId: getActionNodeId(profileIndex, block.name, actionIndex),
            actionLine,
            matchingConditions,
          });
          actionCount += 1;
        }
      }
      if (actionMatches.length > 0) {
        blockMatches.push({
          blockName: block.name,
          actions: actionMatches,
        });
      }
      if (actionCount >= maxActions) {
        break;
      }
    }
    if (blockMatches.length > 0) {
      matches.push({
        profileIndex,
        profileName: profile.name,
        blocks: blockMatches,
      });
    }
    if (actionCount >= maxActions) {
      break;
    }
  }
  return matches;
}

function normalizeSearchValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(SPACE_OR_UNDERSCORE, "_");
}

function normalizedIncludes(value: string, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }
  return normalizeSearchValue(value).includes(normalizedQuery);
}
