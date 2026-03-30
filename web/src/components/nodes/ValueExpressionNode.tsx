import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { ValueExpressionFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";

function ValueExpressionNode({
  data,
  isConnectable,
}: NodeProps<ValueExpressionFlowNode>) {
  return (
    <NodeCard className="lc-node-card--valueExpression">
      <TargetHandle isConnectable={isConnectable} />
      <SourceHandle isConnectable={isConnectable} />

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Value</div>
          <div className="lc-node-title lc-node-title--mono">{data.label}</div>
        </div>
        <MetaPill>Val</MetaPill>
      </div>
    </NodeCard>
  );
}

export default memo(ValueExpressionNode);
