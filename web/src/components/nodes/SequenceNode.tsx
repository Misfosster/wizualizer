import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { SequenceFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";

function SequenceNode({
  data,
  isConnectable,
}: NodeProps<SequenceFlowNode>) {
  const sequenceText =
    data.spells.length > 0 ? data.spells.join(" -> ") : "(empty sequence)";

  return (
    <NodeCard className="lc-node-card--sequence">
      <TargetHandle isConnectable={isConnectable} />
      <SourceHandle isConnectable={isConnectable} />

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Sequence</div>
          <div className="lc-node-title lc-node-title--mono">{sequenceText}</div>
        </div>
        <MetaPill>Seq</MetaPill>
      </div>

      <div className="lc-node-note">{data.label}</div>
    </NodeCard>
  );
}

export default memo(SequenceNode);
