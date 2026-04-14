import { memo } from "react";
import { Minus, Plus } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import type { BlockFlowNode } from "./types";
import { MetaPill, NodeCard, SourceHandle, TargetHandle } from "./shared";
import { useEditorStore } from "@/state/editorStore";

function BlockNode({
  id,
  data,
  isConnectable,
}: NodeProps<BlockFlowNode>) {
  const toggleBlockCollapse = () => {
    useEditorStore.getState().toggleBlockCollapse(id);
  };

  return (
    <NodeCard className="lc-node-card--block">
      <TargetHandle isConnectable={isConnectable} />
      <SourceHandle isConnectable={isConnectable} />

      <div className="lc-node-header">
        <div className="lc-node-copy">
          <div className="lc-node-eyebrow">Block</div>
          <div className="lc-node-title lc-node-title--mono">{data.label}</div>
        </div>
      </div>

      <div className="lc-node-count-row">
        <MetaPill className="lc-node-meta--soft">{data.actionCount} actions</MetaPill>
      </div>

      <button
        type="button"
        className="lc-node-toggle lc-node-toggle--block nodrag nopan"
        aria-label={
          data.isCollapsed
            ? `Expand block ${data.label}`
            : `Collapse block ${data.label}`
        }
        title={data.isCollapsed ? "Expand block" : "Collapse block"}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (event.button !== 0) {
            return;
          }

          event.preventDefault();
          toggleBlockCollapse();
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (event.detail > 0) {
            return;
          }

          toggleBlockCollapse();
        }}
      >
        {data.isCollapsed ? (
          <Plus className="lc-node-toggle-icon" />
        ) : (
          <Minus className="lc-node-toggle-icon" />
        )}
      </button>
    </NodeCard>
  );
}

export default memo(BlockNode);
