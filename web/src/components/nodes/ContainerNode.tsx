import { memo } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { CONDITION_HANDLE_IDS, type ContainerFlowNode } from "./types";
import { SourceHandle, TargetHandle } from "./shared";

const DEPTH_COLORS = ["#3b82f6", "#f59e0b", "#8b5cf6", "#14b8a6"] as const;

function ContainerNode({ data, isConnectable }: NodeProps<ContainerFlowNode>) {
  const borderColor = DEPTH_COLORS[data.depth % DEPTH_COLORS.length];
  const handleUsage = data.handleUsage ?? {};

  return (
    <div
      className="lc-node-container"
      style={{ width: "100%", height: "100%", borderColor }}
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
    </div>
  );
}

export default memo(ContainerNode);
