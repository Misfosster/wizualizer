import { memo } from "react";
import { Package } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import type { UseItemFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";

function UseItemNode({
  data,
  isConnectable,
}: NodeProps<UseItemFlowNode>) {
  return (
    <NodeCard className="lc-node-card--useItem">
      <TargetHandle isConnectable={isConnectable} />
      <SourceHandle isConnectable={isConnectable} />

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Item</div>
          <div className="lc-node-title lc-node-title--mono lc-node-title--inline">
            <Package className="lc-node-icon" />
            <span>{data.itemName}</span>
          </div>
        </div>
        <MetaPill>{data.hasCondition ? "If" : "Item"}</MetaPill>
      </div>

      <div className="lc-node-note">{data.label}</div>
    </NodeCard>
  );
}

export default memo(UseItemNode);
