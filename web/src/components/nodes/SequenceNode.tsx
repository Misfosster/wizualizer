import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { SequenceFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";
import { ActionCollapseToggle } from "./ActionCollapseToggle";
import { ActionPlacementEyebrow } from "./ActionPlacementEyebrow";

function SequenceNode({
  id,
  data,
  isConnectable,
}: NodeProps<SequenceFlowNode>) {
  const sequenceText =
    data.spells.length > 0 ? data.spells.join(" -> ") : "(empty sequence)";

  return (
    <NodeCard
      className={`lc-node-card--sequence ${data.hasChildren ? "lc-node-card--actionCollapsible" : ""}`}
      talentState={data.talentState}
      talentReason={data.talentReason}
    >
      <TargetHandle isConnectable={isConnectable} />
      {data.hasChildren && !data.isCollapsed ? (
        <SourceHandle isConnectable={isConnectable} />
      ) : null}

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <ActionPlacementEyebrow
            actionListName={data.actionListName}
            sourceLineNumber={data.sourceLineNumber}
          />
          <div className="lc-node-title lc-node-title--mono">{sequenceText}</div>
        </div>
        {data.hasChildren ? (
          <div className="lc-node-action-controls">
            <ActionCollapseToggle
              actionId={id}
              label={data.label}
              isCollapsed={data.isCollapsed}
            />
          </div>
        ) : (
          <MetaPill>Seq</MetaPill>
        )}
      </div>

      <div className="lc-node-note">{data.label}</div>
    </NodeCard>
  );
}

export default memo(SequenceNode);
