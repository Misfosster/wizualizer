import { memo } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import {
  CONDITION_HANDLE_IDS,
  type ValueExpressionFlowNode,
} from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";

function ValueExpressionNode({
  data,
  isConnectable,
}: NodeProps<ValueExpressionFlowNode>) {
  const handleUsage = data.handleUsage ?? {};

  return (
    <NodeCard
      className="lc-node-card--valueExpression"
      talentState={data.talentState}
      talentReason={data.talentReason}
    >
      {handleUsage.targetLeft ? (
        <TargetHandle
          isConnectable={isConnectable}
          id={CONDITION_HANDLE_IDS.targetLeft}
        />
      ) : null}
      {handleUsage.sourceRight ? (
        <SourceHandle
          isConnectable={isConnectable}
          id={CONDITION_HANDLE_IDS.sourceRight}
        />
      ) : null}
      {handleUsage.targetTop ? (
        <TargetHandle
          isConnectable={isConnectable}
          id={CONDITION_HANDLE_IDS.targetTop}
          position={Position.Top}
        />
      ) : null}
      {handleUsage.sourceBottom ? (
        <SourceHandle
          isConnectable={isConnectable}
          id={CONDITION_HANDLE_IDS.sourceBottom}
          position={Position.Bottom}
        />
      ) : null}

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
