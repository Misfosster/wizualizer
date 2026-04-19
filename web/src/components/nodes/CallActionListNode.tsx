import { memo } from "react";
import { ArrowRight } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import type { CallActionListFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";
import { ActionCollapseToggle } from "./ActionCollapseToggle";

function CallActionListNode({
  id,
  data,
  isConnectable,
}: NodeProps<CallActionListFlowNode>) {
  return (
    <NodeCard
      className={`lc-node-card--callActionList ${data.hasChildren ? "lc-node-card--actionCollapsible" : ""}`}
      talentState={data.talentState}
    >
      <TargetHandle isConnectable={isConnectable} />
      {data.hasChildren && !data.isCollapsed ? (
        <SourceHandle isConnectable={isConnectable} />
      ) : null}

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Call List</div>
          <div className="lc-node-title lc-node-title--mono lc-node-title--inline">
            <ArrowRight className="lc-node-icon" />
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
