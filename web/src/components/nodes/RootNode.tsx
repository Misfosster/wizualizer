import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { RootFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";

function RootNode({
  data,
  isConnectable,
}: NodeProps<RootFlowNode>) {
  return (
    <NodeCard className="lc-node-card--root">
      <TargetHandle isConnectable={isConnectable} />
      <SourceHandle isConnectable={isConnectable} />

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Profile</div>
          <div className="lc-node-title">{data.label}</div>
        </div>
        <MetaPill>Root</MetaPill>
      </div>

      <div className="lc-node-count-row">
        <MetaPill className="lc-node-meta--soft">{data.blockCount} blocks</MetaPill>
        <MetaPill className="lc-node-meta--soft">{data.actionCount} actions</MetaPill>
      </div>
    </NodeCard>
  );
}

export default memo(RootNode);
