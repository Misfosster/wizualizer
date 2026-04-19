import { memo } from "react";
import { Package } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import type { UseItemFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";
import { ActionCollapseToggle } from "./ActionCollapseToggle";

function UseItemNode({
  id,
  data,
  isConnectable,
}: NodeProps<UseItemFlowNode>) {
  return (
    <NodeCard
      className={`lc-node-card--useItem ${data.hasChildren ? "lc-node-card--actionCollapsible" : ""}`}
      talentState={data.talentState}
    >
      <TargetHandle isConnectable={isConnectable} />
      {data.hasChildren && !data.isCollapsed ? (
        <SourceHandle isConnectable={isConnectable} />
      ) : null}

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Item</div>
          <div className="lc-node-title lc-node-title--mono lc-node-title--inline">
            <Package className="lc-node-icon" />
            <span>{data.itemName}</span>
          </div>
        </div>
        {data.hasChildren ? (
          <div className="lc-node-action-controls">
            <ActionCollapseToggle
              actionId={id}
              label={data.itemName}
              isCollapsed={data.isCollapsed}
            />
          </div>
        ) : (
          <MetaPill>Item</MetaPill>
        )}
      </div>

      <div className="lc-node-note">{data.label}</div>
    </NodeCard>
  );
}

export default memo(UseItemNode);
