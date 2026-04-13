import { useCallback, useEffect, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Panel,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useEditorStore } from "@/state/editorStore";
import { nodeTypes } from "@components/nodes";
import type { GraphFlowNode } from "@components/nodes/types";

import "@xyflow/react/dist/style.css";

const defaultEdgeOptions = {
  type: "smoothstep",
  pathOptions: {
    borderRadius: 12,
    offset: 20,
  },
} as const;
const bulkToggleFitViewOptions = { padding: 0.35, maxZoom: 1 } as const;
const firstNodeViewportAnchor = { x: 0.33, y: 0.25 } as const;

export default function Canvas() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const flowRef = useRef<ReactFlowInstance<GraphFlowNode> | null>(null);
  const shouldFitAfterBulkToggleRef = useRef(false);
  const nodes = useEditorStore((state) => state.nodes);
  const edges = useEditorStore((state) => state.edges);
  const toggleAllBlocksCollapse = useEditorStore(
    (state) => state.toggleAllBlocksCollapse,
  );
  const blockCount = nodes.reduce(
    (count, node) => (node.type === "block" ? count + 1 : count),
    0,
  );
  const collapsedBlockCount = nodes.reduce(
    (count, node) =>
      node.type === "block" && node.data.isCollapsed ? count + 1 : count,
    0,
  );
  const shouldExpandAll =
    blockCount > 0 && collapsedBlockCount === blockCount;
  const toggleAllLabel = shouldExpandAll ? "Expand All" : "Collapse All";
  const handleToggleAllBlocksCollapse = useCallback(() => {
    shouldFitAfterBulkToggleRef.current = !shouldExpandAll;
    toggleAllBlocksCollapse();
  }, [shouldExpandAll, toggleAllBlocksCollapse]);

  useEffect(() => {
    if (!shouldFitAfterBulkToggleRef.current) {
      return;
    }

    shouldFitAfterBulkToggleRef.current = false;
    requestAnimationFrame(() => {
      const flow = flowRef.current;
      const canvas = canvasRef.current;
      const firstNode = flow?.getNodes()[0];
      if (!flow || !canvas || !firstNode) {
        return;
      }

      void flow.fitView(bulkToggleFitViewOptions).then(() => {
        const firstNodeBounds = flow.getNodesBounds([firstNode.id]);
        const { zoom } = flow.getViewport();
        const anchorX = canvas.clientWidth * firstNodeViewportAnchor.x;
        const anchorY = canvas.clientHeight * firstNodeViewportAnchor.y;
        const firstNodeCenterX =
          firstNodeBounds.x + firstNodeBounds.width / 2;
        const firstNodeCenterY =
          firstNodeBounds.y + firstNodeBounds.height / 2;

        void flow.setViewport({
          x: anchorX - firstNodeCenterX * zoom,
          y: anchorY - firstNodeCenterY * zoom,
          zoom,
        });
      });
    });
  }, [nodes]);

  return (
    <div
      ref={canvasRef}
      className="h-full w-full min-h-[300px] bg-white text-gray-900"
    >
      <ReactFlow
        className="lc-flow"
        style={{ width: "100%", height: "100%" }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          flowRef.current = instance;
        }}
        connectionLineType={ConnectionLineType.Step}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView={true}
        onlyRenderVisibleElements={true}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Panel position="top-left" className="m-3">
          <button
            type="button"
            className="nodrag nopan rounded-md border border-gray-300 bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={blockCount === 0}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (event.button !== 0) {
                return;
              }

              event.preventDefault();
              handleToggleAllBlocksCollapse();
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (event.detail > 0) {
                return;
              }

              handleToggleAllBlocksCollapse();
            }}
          >
            {toggleAllLabel}
          </button>
        </Panel>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
      </ReactFlow>
    </div>
  );
}
