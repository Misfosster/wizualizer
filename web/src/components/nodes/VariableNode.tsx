import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { VariableFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";

function VariableNode({
  data,
  isConnectable,
}: NodeProps<VariableFlowNode>) {
  return (
    <NodeCard className="lc-node-card--variable">
      <TargetHandle isConnectable={isConnectable} />
      <SourceHandle
        isConnectable={isConnectable}
        id="val"
        className="lc-node-handle--val"
      />
      <SourceHandle
        isConnectable={isConnectable}
        id="if"
        className="lc-node-handle--if"
      />

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Variable</div>
          <div className="lc-node-title lc-node-title--mono">
            {data.variableName}
          </div>
        </div>
      </div>

      {data.hasExplicitOp ? (
        <div className="lc-node-chip-row">
          <MetaPill className="lc-node-meta--strong lc-node-meta--mono">
            {data.op}
          </MetaPill>
        </div>
      ) : null}

      <div className="lc-node-note">{data.label}</div>
    </NodeCard>
  );
}

export default memo(VariableNode);
