import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Panel,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/state/editorStore";
import { nodeTypes } from "@components/nodes";
import type { GraphFlowNode } from "@components/nodes/types";
import { TalentModePanel } from "./canvas/talent-mode-panel";
import { EmptyGraphPlaceholder } from "./canvas/empty-graph-placeholder";

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
const canvasBackground =
  "radial-gradient(circle at 35% 10%, #3b414f 0%, #2d313c 38%, #222733 78%)";
const reactFlowStyle = {
  width: "100%",
  height: "100%",
  background: canvasBackground,
} as const;
const reactFlowProOptions = { hideAttribution: true } as const;

export default function Canvas() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const flowRef = useRef<ReactFlowInstance<GraphFlowNode> | null>(null);
  const shouldFitAfterBulkToggleRef = useRef(false);
  const didInitialFitRef = useRef(false);
  const {
    nodes,
    edges,
    toggleAllBlocksCollapse,
    talentRenderMode,
    setTalentRenderMode,
    clearGraphJumpTarget,
    graphJumpTarget,
    document,
  } = useEditorStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      toggleAllBlocksCollapse: state.toggleAllBlocksCollapse,
      talentRenderMode: state.talentRenderMode,
      setTalentRenderMode: state.setTalentRenderMode,
      clearGraphJumpTarget: state.clearGraphJumpTarget,
      graphJumpTarget: state.graphJumpTarget,
      document: state.document,
    })),
  );
  const { blockCount, shouldExpandAll } = useMemo(() => {
    let nextBlockCount = 0;
    let nextCollapsedBlockCount = 0;

    for (const node of nodes) {
      if (node.type !== "block") {
        continue;
      }

      nextBlockCount += 1;
      if (node.data.isCollapsed) {
        nextCollapsedBlockCount += 1;
      }
    }

    return {
      blockCount: nextBlockCount,
      shouldExpandAll:
        nextBlockCount > 0 && nextCollapsedBlockCount === nextBlockCount,
    };
  }, [nodes]);
  const toggleAllLabel = shouldExpandAll ? "Expand All" : "Collapse All";
  const handleToggleAllBlocksCollapse = useCallback(() => {
    shouldFitAfterBulkToggleRef.current = !shouldExpandAll;
    toggleAllBlocksCollapse();
  }, [shouldExpandAll, toggleAllBlocksCollapse]);

  // Hide-mode wipeout: parsed document has at least one profile, but the
  // filter pass dropped every node. Distinguishes "user has not pasted any
  // APL yet" (document is null) from "filter ate everything" (document
  // exists but the graph is empty).
  const hasParsedProfiles = (document?.profiles.length ?? 0) > 0;
  const isHideWipeout =
    talentRenderMode === "hide" && hasParsedProfiles && nodes.length === 0;
  const handleSwitchToDim = useCallback(() => {
    setTalentRenderMode("dim");
  }, [setTalentRenderMode]);

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

  useEffect(() => {
    if (didInitialFitRef.current || nodes.length === 0) {
      return;
    }
    const flow = flowRef.current;
    if (!flow) {
      return;
    }
    didInitialFitRef.current = true;
    void flow.fitView({ padding: 0.35, maxZoom: 1 });
  }, [nodes]);

  useEffect(() => {
    if (!graphJumpTarget) {
      return;
    }
    const flow = flowRef.current;
    if (!flow) {
      return;
    }

    const targetNode = flow.getNode(graphJumpTarget.actionId);
    if (!targetNode) {
      if (talentRenderMode === "hide") {
        // Hidden actions are not present as nodes; switch to Dim so users can jump.
        setTalentRenderMode("dim");
        return;
      }
      clearGraphJumpTarget();
      return;
    }

    const bounds = flow.getNodesBounds([targetNode.id]);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const currentZoom = flow.getViewport().zoom;
    void flow
      .setCenter(centerX, centerY, {
        duration: 250,
        zoom: currentZoom,
      })
      .finally(() => {
        clearGraphJumpTarget();
      });
  }, [
    clearGraphJumpTarget,
    graphJumpTarget,
    setTalentRenderMode,
    talentRenderMode,
  ]);

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full min-h-[300px] text-slate-100"
      style={{ background: canvasBackground }}
    >
      <ReactFlow
        className="lc-flow"
        style={reactFlowStyle}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          flowRef.current = instance;
        }}
        connectionLineType={ConnectionLineType.Step}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView={false}
        onlyRenderVisibleElements={true}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={reactFlowProOptions}
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
        <Panel
          position="top-right"
          className="m-3 h-[calc(100%-1.5rem)] overflow-hidden"
        >
          <TalentModePanel />
        </Panel>
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(255, 255, 255, 0.035)"
        />
      </ReactFlow>
      <EmptyGraphPlaceholder
        mode={isHideWipeout ? "hide" : "off"}
        onSwitchToDim={handleSwitchToDim}
      />
    </div>
  );
}
