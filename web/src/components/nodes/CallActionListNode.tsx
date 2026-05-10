import { memo } from "react";
import { ArrowRight } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import type { CallActionListFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";
import { ActionCollapseToggle } from "./ActionCollapseToggle";
import { useEditorStore } from "@/state/editorStore";

function CallActionListNode({
  id,
  data,
  isConnectable,
}: NodeProps<CallActionListFlowNode>) {
  const jumpToTargetList = () => {
    if (!data.targetBlockId) {
      return;
    }
    useEditorStore.getState().requestGraphJumpToNode(data.targetBlockId);
  };

  return (
    <NodeCard
      className={`lc-node-card--callActionList ${data.hasChildren ? "lc-node-card--actionCollapsible" : ""}`}
      talentState={data.talentState}
      talentReason={data.talentReason}
    >
      <TargetHandle isConnectable={isConnectable} />
      {data.hasChildren && !data.isCollapsed ? (
        <SourceHandle isConnectable={isConnectable} />
      ) : null}

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Call List</div>
          <div className="lc-node-title lc-node-title--mono lc-node-title--inline">
            {data.targetBlockId ? (
              <button
                type="button"
                className="lc-node-inline-jump nodrag nopan"
                aria-label={`Jump to action list ${data.targetList}`}
                title={`Jump to ${data.targetList}`}
                data-call-list-jump={data.targetBlockId}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (event.button !== 0) {
                    return;
                  }

                  event.preventDefault();
                  jumpToTargetList();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.detail > 0) {
                    return;
                  }

                  jumpToTargetList();
                }}
              >
                <ArrowRight className="lc-node-icon" aria-hidden="true" />
              </button>
            ) : (
              <ArrowRight className="lc-node-icon" aria-hidden="true" />
            )}
            <span>{data.targetList}</span>
          </div>
        </div>
        {data.hasChildren ? (
          <div className="lc-node-action-controls">
            <ActionCollapseToggle
              actionId={id}
              label={data.targetList}
              isCollapsed={data.isCollapsed}
            />
          </div>
        ) : (
          <MetaPill>Call</MetaPill>
        )}
      </div>

      <div className="lc-node-note">{data.label}</div>
    </NodeCard>
  );
}

export default memo(CallActionListNode);
