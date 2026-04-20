import { useMemo, useState } from "react";
import { ChevronRight, Edit3, Save } from "lucide-react";
import { getConditionSegments, type ConditionSegment } from "@/utils/apl-parser/action-data";
import { getActionNodeId } from "@/utils/apl-parser/node-ids";
import { parseAction, parseConditionExpression } from "@/utils/apl-parser/parser";
import { prettyAction, prettyCond } from "@/utils/apl-parser/pretty-log";
import type { ParsedActionLine } from "@/utils/apl-parser/document";
import { ConditionAstTree } from "./graph-explorer-condition-ast";
import { leadingWhitespace } from "./graph-explorer-utils";

interface DragActionRef {
  profileIndex: number;
  blockName: string;
  lineNumber: number;
}

type DropPlacement = "before" | "after";

export interface GraphExplorerActionLeafProps {
  profileIndex: number;
  blockName: string;
  actionIndex: number;
  actionLine: ParsedActionLine;
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
}

export function GraphExplorerActionLeaf({
  profileIndex,
  blockName,
  actionIndex,
  actionLine,
  isReadOnly,
  onReplaceSourceLine,
  onJump,
  dragSource,
  onDragStart,
  onDragEnd,
  onDropReorder,
}: GraphExplorerActionLeafProps) {
  const [actionDraft, setActionDraft] = useState<string>(() => actionLine.rawLine.trim());
  const [actionError, setActionError] = useState<string>("");
  const [isEditingAction, setEditingAction] = useState<boolean>(false);
  const [dropPlacement, setDropPlacement] = useState<DropPlacement | null>(null);
  const conditionEntries = useMemo(
    () =>
      getConditionSegments(actionLine.action.segments).map((segment, conditionIndex) => ({
        conditionIndex,
        segment,
      })),
    [actionLine.action.segments],
  );
  const nodeId = getActionNodeId(profileIndex, blockName, actionIndex);
  const isInheritedLine = actionLine.isInherited === true;
  const isActionEditable = !isReadOnly && !isInheritedLine && actionLine.lineNumber > 0;
  const actionEditDisabledReason = isReadOnly
    ? "Resolve parse errors before editing."
    : isInheritedLine
      ? "Inherited copy lines are read-only. Override them in the copied profile."
      : "";
  const isCurrentDragSource =
    dragSource?.profileIndex === profileIndex &&
    dragSource.blockName === blockName &&
    dragSource.lineNumber === actionLine.lineNumber;
  const canDropOnRow =
    dragSource !== null &&
    dragSource.profileIndex === profileIndex &&
    dragSource.blockName === blockName &&
    dragSource.lineNumber !== actionLine.lineNumber &&
    isActionEditable;

  function saveActionLine(): void {
    if (!isActionEditable) {
      return;
    }
    const candidate = actionDraft.trim();
    if (!candidate) {
      setActionError("Action line cannot be empty.");
      return;
    }
    try {
      const parsed = parseAction(candidate);
      if (!parsed) {
        setActionError("Action line did not parse.");
        return;
      }
      const nextLine = `${leadingWhitespace(actionLine.rawLine)}${prettyAction(parsed)}`;
      onReplaceSourceLine(actionLine.lineNumber, nextLine);
      setActionError("");
      setEditingAction(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <li
      draggable={isActionEditable}
      onDragStart={(event) => {
        if (!isActionEditable) {
          event.preventDefault();
          return;
        }
        onDragStart({ profileIndex, blockName, lineNumber: actionLine.lineNumber });
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        setDropPlacement(null);
        onDragEnd();
      }}
      onDragOver={(event) => {
        if (!canDropOnRow) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const rect = event.currentTarget.getBoundingClientRect();
        const placement: DropPlacement =
          event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        setDropPlacement(placement);
      }}
      onDragLeave={() => {
        setDropPlacement(null);
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (!canDropOnRow) {
          setDropPlacement(null);
          return;
        }
        const placement = dropPlacement ?? "after";
        onDropReorder(
          { profileIndex, blockName, lineNumber: actionLine.lineNumber },
          placement,
        );
        setDropPlacement(null);
      }}
      className={`rounded border border-gray-200 bg-gray-50/70 p-2 ${
        isCurrentDragSource ? "opacity-60" : ""
      } ${
        dropPlacement === "before"
          ? "border-t-2 border-t-blue-500"
          : dropPlacement === "after"
            ? "border-b-2 border-b-blue-500"
            : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-[11px] font-semibold text-gray-800">
            {actionLine.action.spell}
          </p>
          <p className="truncate text-[10px] text-gray-500">line {String(actionLine.lineNumber)}</p>
          {isInheritedLine ? (
            <p className="truncate text-[10px] text-amber-700">inherited from source profile</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!isActionEditable}
            onClick={() => {
              if (!isActionEditable) {
                return;
              }
              setEditingAction((prev) => !prev);
              setActionError("");
              setActionDraft(actionLine.rawLine.trim());
            }}
            className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Edit action line ${String(actionLine.lineNumber)}`}
            title={actionEditDisabledReason || undefined}
          >
            <Edit3 className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              onJump(nodeId);
            }}
            className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Jump to ${actionLine.action.spell}`}
          >
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isEditingAction ? (
        <div className="mt-2 rounded border border-gray-300 bg-white p-2">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Action line
          </label>
          <textarea
            value={actionDraft}
            onChange={(event) => {
              setActionDraft(event.target.value);
            }}
            rows={2}
            className="nodrag nopan w-full resize-y rounded border border-gray-300 px-2 py-1 font-mono text-[11px] text-gray-700 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {actionError ? (
            <p className="mt-1 text-[10px] text-red-600">{actionError}</p>
          ) : null}
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              disabled={!isActionEditable}
              onClick={saveActionLine}
              className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Save className="h-3 w-3" aria-hidden="true" />
              Save action
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingAction(false);
                setActionError("");
                setActionDraft(actionLine.rawLine.trim());
              }}
              className="rounded border border-transparent px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 truncate font-mono text-[10px] text-gray-600">{actionLine.rawLine.trim()}</p>
      )}

      {conditionEntries.length > 0 ? (
        <ul className="m-0 mt-2 list-none space-y-1 p-0">
          {conditionEntries.map((entry) => (
            <ConditionEditorRow
              key={`${actionLine.lineNumber}:${entry.conditionIndex}:${entry.segment.type}`}
              conditionIndex={entry.conditionIndex}
              segment={entry.segment}
              actionLine={actionLine}
              isReadOnly={!isActionEditable}
              onReplaceSourceLine={onReplaceSourceLine}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ConditionEditorRow({
  conditionIndex,
  segment,
  actionLine,
  isReadOnly,
  onReplaceSourceLine,
}: {
  conditionIndex: number;
  segment: ConditionSegment;
  actionLine: ParsedActionLine;
  isReadOnly: boolean;
  onReplaceSourceLine: (lineNumber: number, nextLine: string) => void;
}) {
  const [draft, setDraft] = useState<string>(() => prettyCond(segment.expr));
  const [error, setError] = useState<string>("");
  const [isEditing, setEditing] = useState<boolean>(false);

  function saveCondition(): void {
    if (isReadOnly) {
      return;
    }
    try {
      const nextExpr = parseConditionExpression(draft.trim());
      const parsedAction = parseAction(actionLine.rawLine.trim());
      if (!parsedAction) {
        setError("Action line did not parse.");
        return;
      }
      let seen = -1;
      const nextSegments = parsedAction.segments.map((currentSegment) => {
        if (currentSegment.type !== "if" && currentSegment.type !== "target_if") {
          return currentSegment;
        }
        seen += 1;
        if (seen !== conditionIndex) {
          return currentSegment;
        }
        return { ...currentSegment, expr: nextExpr };
      });
      const nextAction = { ...parsedAction, segments: nextSegments };
      const nextLine = `${leadingWhitespace(actionLine.rawLine)}${prettyAction(nextAction)}`;
      onReplaceSourceLine(actionLine.lineNumber, nextLine);
      setError("");
      setEditing(false);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : String(parseError));
    }
  }

  return (
    <li className="rounded border border-gray-200 bg-white p-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {segment.type}
        </span>
        <button
          type="button"
          disabled={isReadOnly}
          onClick={() => {
            if (isReadOnly) {
              return;
            }
            setEditing((prev) => !prev);
            setError("");
            setDraft(prettyCond(segment.expr));
          }}
          className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`Edit ${segment.type} condition`}
          title={isReadOnly ? "Condition editing is disabled for this row." : undefined}
        >
          Edit condition
        </button>
      </div>
      {isEditing ? (
        <div className="mt-1">
          <input
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            className="nodrag nopan w-full rounded border border-gray-300 px-2 py-1 font-mono text-[11px] text-gray-700 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {error ? <p className="mt-1 text-[10px] text-red-600">{error}</p> : null}
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              disabled={isReadOnly}
              onClick={saveCondition}
              className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Save className="h-3 w-3" aria-hidden="true" />
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError("");
                setDraft(prettyCond(segment.expr));
              }}
              className="rounded border border-transparent px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1">
          <p className="truncate font-mono text-[10px] text-gray-700">{prettyCond(segment.expr)}</p>
          <ConditionAstTree expr={segment.expr} />
        </div>
      )}
    </li>
  );
}
