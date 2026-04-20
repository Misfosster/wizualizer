import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { VariableFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";
import { ActionCollapseToggle } from "./ActionCollapseToggle";
import { cn } from "@/lib/utils";

function VariableNode({
  id,
  data,
  isConnectable,
}: NodeProps<VariableFlowNode>) {
  return (
    <NodeCard
      className={`lc-node-card--variable ${data.hasChildren ? "lc-node-card--actionCollapsible" : ""}`}
      talentState={data.talentState}
      talentReason={data.talentReason}
    >
      <TargetHandle isConnectable={isConnectable} />
      {!data.isCollapsed ? (
        <SourceHandle
          isConnectable={isConnectable}
          id="val"
          className={cn(data.hasCondition && "lc-node-handle--val")}
        />
      ) : null}
      {data.hasCondition && !data.isCollapsed ? (
        <SourceHandle
          isConnectable={isConnectable}
          id="if"
          className="lc-node-handle--if"
        />
      ) : null}

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Variable</div>
          <div className="lc-node-title lc-node-title--mono">
            {data.variableName}
          </div>
        </div>
        {data.hasChildren ? (
          <div className="lc-node-action-controls">
            <ActionCollapseToggle
              actionId={id}
              label={data.variableName}
              isCollapsed={data.isCollapsed}
            />
          </div>
        ) : null}
      </div>

      {data.hasExplicitOp ? (
        <div className="lc-node-chip-row">
          <MetaPill className="lc-node-meta--strong lc-node-meta--mono">
            {data.op}
          </MetaPill>
        </div>
      ) : null}

    </NodeCard>
  );
}

export default memo(VariableNode);
