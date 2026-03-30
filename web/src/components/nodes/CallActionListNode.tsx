import { memo } from "react";
import { ArrowRight } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import type { CallActionListFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";

function CallActionListNode({
  data,
  isConnectable,
}: NodeProps<CallActionListFlowNode>) {
  return (
    <NodeCard className="lc-node-card--callActionList">
      <TargetHandle isConnectable={isConnectable} />
      <SourceHandle isConnectable={isConnectable} />

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Call List</div>
          <div className="lc-node-title lc-node-title--mono lc-node-title--inline">
            <ArrowRight className="lc-node-icon" />
            <span>{data.targetList}</span>
          </div>
        </div>
        <MetaPill>Call</MetaPill>
      </div>

      <div className="lc-node-note">{data.label}</div>
    </NodeCard>
  );
}

export default memo(CallActionListNode);
