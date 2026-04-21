import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/state/editorStore";
import {
  filterProfiles,
  moveLine,
  replaceLineAt,
  type FilteredProfile,
} from "./graph-explorer-utils";
import { GraphExplorerActionLeaf } from "./graph-explorer-action-leaf";

interface DragActionRef {
  profileIndex: number;
  blockName: string;
  lineNumber: number;
}

type DropPlacement = "before" | "after";

export function GraphExplorerSection() {
  const [query, setQuery] = useState("");
  const [dragSource, setDragSource] = useState<DragActionRef | null>(null);
  const { document, aplText, parseError, applyAplText, requestGraphJumpToNode } = useEditorStore(
    useShallow((state) => ({
      document: state.document,
      aplText: state.aplText,
      parseError: state.parseError,
      applyAplText: state.applyAplText,
      requestGraphJumpToNode: state.requestGraphJumpToNode,
    })),
  );
  const isReadOnly = parseError !== null;
  const profiles = document?.profiles ?? [];
  const filteredProfiles = useMemo(
    () => filterProfiles(profiles, query.trim().toLowerCase()),
    [profiles, query],
  );
  const visibleActionCount = useMemo(
    () =>
      filteredProfiles.reduce(
        (total, profile) =>
          total +
          profile.blocks.reduce(
            (blockTotal, block) => blockTotal + block.actions.length,
            0,
          ),
        0,
      ),
    [filteredProfiles],
  );

  function replaceSourceLine(lineNumber: number, nextLine: string): void {
    if (isReadOnly) {
      return;
    }
    const nextText = replaceLineAt(aplText, lineNumber, nextLine);
    if (nextText !== aplText) {
      applyAplText(nextText);
    }
  }

  function handleDropReorder(
    target: { profileIndex: number; blockName: string; lineNumber: number },
    placement: DropPlacement,
  ): void {
    if (isReadOnly || dragSource === null) {
      setDragSource(null);
      return;
    }
    if (
      dragSource.profileIndex !== target.profileIndex ||
      dragSource.blockName !== target.blockName ||
      dragSource.lineNumber === target.lineNumber
    ) {
      setDragSource(null);
      return;
    }
    const nextText = moveLine(aplText, dragSource.lineNumber, target.lineNumber, placement);
    if (nextText !== aplText) {
      applyAplText(nextText);
    }
    setDragSource(null);
  }

  return (
    <section className="mt-2">
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          APL explorer
        </h3>
        <span className="text-[10px] text-gray-500">
          {String(visibleActionCount)} actions
        </span>
      </header>
      <div className="relative mt-2">
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
          placeholder="Search profiles, blocks, actions, conditions..."
          className="nodrag nopan w-full rounded border border-gray-300 bg-white py-1 pl-7 pr-7 text-[11px] text-gray-700 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Clear explorer search"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {parseError ? (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
          Fix parse errors before editing AST rows.
        </p>
      ) : null}
      <ul
        className="m-0 mt-2 max-h-[45vh] list-none space-y-2 overflow-y-auto p-0"
        onWheel={(event) => {
          event.stopPropagation();
        }}
      >
        {filteredProfiles.map((profile) => (
          <ProfileFolder
            key={`${String(profile.profileIndex)}:${profile.profileName}`}
            profile={profile}
            isReadOnly={isReadOnly}
            onReplaceSourceLine={replaceSourceLine}
            onJump={requestGraphJumpToNode}
            dragSource={dragSource}
            onDragStart={setDragSource}
            onDragEnd={() => {
              setDragSource(null);
            }}
            onDropReorder={handleDropReorder}
          />
        ))}
      </ul>
      {filteredProfiles.length === 0 ? (
        <p className="mt-2 text-[11px] italic text-gray-500">No matching AST items.</p>
      ) : null}
    </section>
  );
}

function ProfileFolder({
  profile,
  isReadOnly,
  onReplaceSourceLine,
  onJump,
  dragSource,
  onDragStart,
  onDragEnd,
  onDropReorder,
}: {
  profile: FilteredProfile;
  isReadOnly: boolean;
  onReplaceSourceLine: (lineNumber: number, nextLine: string) => void;
  onJump: (nodeId: string) => void;
  dragSource: DragActionRef | null;
  onDragStart: (value: DragActionRef) => void;
  onDragEnd: () => void;
  onDropReorder: (
    target: { profileIndex: number; blockName: string; lineNumber: number },
    placement: DropPlacement,
  ) => void;
}) {
  const actionCount = profile.blocks.reduce(
    (total, block) => total + block.actions.length,
    0,
  );

  return (
    <li className="rounded border border-gray-200 bg-gray-50/70 p-2">
      <details>
        <summary className="cursor-pointer select-none text-[11px] font-semibold text-gray-700">
          profile: {profile.profileName} ({String(profile.blocks.length)} blocks,{" "}
          {String(actionCount)} actions)
        </summary>
        <ul className="m-0 mt-2 list-none space-y-2 p-0">
          {profile.blocks.map((block) => (
            <li key={block.blockName} className="rounded border border-gray-200 bg-white p-2">
              <details>
                <summary className="cursor-pointer select-none text-[11px] font-semibold text-gray-700">
                  block: {block.blockName} ({String(block.actions.length)})
                </summary>
                <ul className="m-0 mt-2 list-none space-y-2 p-0">
                  {block.actions.map((entry) => (
                    <GraphExplorerActionLeaf
                      key={`${String(profile.profileIndex)}:${block.blockName}:${String(entry.actionIndex)}:${String(entry.actionLine.lineNumber)}`}
                      profileIndex={profile.profileIndex}
                      blockName={block.blockName}
                      actionIndex={entry.actionIndex}
                      actionLine={entry.actionLine}
                      isReadOnly={isReadOnly}
                      onReplaceSourceLine={onReplaceSourceLine}
                      onJump={onJump}
                      dragSource={dragSource}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDropReorder={onDropReorder}
                    />
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
