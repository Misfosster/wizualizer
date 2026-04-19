import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { ActionFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";
import { ActionCollapseToggle } from "./ActionCollapseToggle";

function ActionNode({
  id,
  data,
  isConnectable,
}: NodeProps<ActionFlowNode>) {
  return (
    <NodeCard
      className={`lc-node-card--action ${data.hasChildren ? "lc-node-card--actionCollapsible" : ""}`}
      talentState={data.talentState}
    >
      <TargetHandle isConnectable={isConnectable} />
      {data.hasChildren && !data.isCollapsed ? (
        <SourceHandle isConnectable={isConnectable} />
      ) : null}

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Action</div>
          <div className="lc-node-title lc-node-title--mono">{data.label}</div>
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
          <MetaPill>Action</MetaPill>
        )}
      </div>
    </NodeCard>
  );
}

export default memo(ActionNode);
