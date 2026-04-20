import { memo } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { CONDITION_HANDLE_IDS, type ContainerFlowNode } from "./types";
import { SourceHandle, TargetHandle } from "./shared";

const DEPTH_COLORS = [
  "rgba(96, 165, 250, 0.42)",
  "rgba(245, 158, 11, 0.42)",
  "rgba(167, 139, 250, 0.42)",
  "rgba(45, 212, 191, 0.42)",
] as const;

function ContainerNode({ data, isConnectable }: NodeProps<ContainerFlowNode>) {
  const borderColor = DEPTH_COLORS[data.depth % DEPTH_COLORS.length];
  const handleUsage = data.handleUsage ?? {};
  const isImpossible = data.talentState === "impossible";

  return (
    <div
      className={
        isImpossible
          ? "lc-node-container lc-node-container--impossible"
          : "lc-node-container"
      }
      data-talent-state={data.talentState ?? "normal"}
      data-talent-reason={
        isImpossible ? (data.talentReason ?? "filtered") : undefined
      }
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
