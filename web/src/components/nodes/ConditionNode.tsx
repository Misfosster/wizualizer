import { memo } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { CONDITION_HANDLE_IDS, type ConditionFlowNode } from "./types";
import { NodeCard, SourceHandle, TargetHandle } from "./shared";
import { cn } from "@/lib/utils";

function ConditionNode({
  data,
  isConnectable,
}: NodeProps<ConditionFlowNode>) {
  const handleUsage = data.handleUsage ?? {};
  const isTargetIf = data.segmentKind === "target_if";

  return (
    <NodeCard
      className={cn(
        "lc-node-card--condition",
        isTargetIf && "lc-node-card--targetCondition",
      )}
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
          <div className="lc-node-eyebrow">
            {isTargetIf ? "Target If" : "Condition"}
          </div>
          <div className="lc-node-title lc-node-title--mono">{data.label}</div>
        </div>
      </div>
    </NodeCard>
  );
}

export default memo(ConditionNode);
