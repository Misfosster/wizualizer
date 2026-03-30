import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { ActionFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";

function ActionNode({
  data,
  isConnectable,
}: NodeProps<ActionFlowNode>) {
  return (
    <NodeCard className="lc-node-card--action">
      <TargetHandle isConnectable={isConnectable} />
      <SourceHandle isConnectable={isConnectable} />

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Action</div>
          <div className="lc-node-title lc-node-title--mono">{data.label}</div>
        </div>
        {data.hasCondition ? <MetaPill>If</MetaPill> : <MetaPill>Action</MetaPill>}
      </div>
    </NodeCard>
  );
}

export default memo(ActionNode);
