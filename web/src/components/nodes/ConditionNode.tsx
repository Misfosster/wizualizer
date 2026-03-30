import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { ConditionFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";

function ConditionNode({
  data,
  isConnectable,
}: NodeProps<ConditionFlowNode>) {
  return (
    <NodeCard className="lc-node-card--condition">
      <TargetHandle isConnectable={isConnectable} />
      <SourceHandle isConnectable={isConnectable} />

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Condition</div>
          <div className="lc-node-title lc-node-title--mono">{data.label}</div>
        </div>
        <MetaPill>If</MetaPill>
      </div>
    </NodeCard>
  );
}

export default memo(ConditionNode);
