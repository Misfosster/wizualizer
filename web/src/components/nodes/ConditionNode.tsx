import { memo } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { CONDITION_HANDLE_IDS, type ConditionFlowNode } from "./types";
import { NodeCard, SourceHandle, TargetHandle } from "./shared";

function ConditionNode({
  data,
  isConnectable,
}: NodeProps<ConditionFlowNode>) {
  const handleUsage = data.handleUsage ?? {};

  return (
    <NodeCard className="lc-node-card--condition">
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
          <div className="lc-node-eyebrow">Condition</div>
          <div className="lc-node-title lc-node-title--mono">{data.label}</div>
        </div>
      </div>
    </NodeCard>
  );
}

export default memo(ConditionNode);
