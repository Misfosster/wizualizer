import { Background, BackgroundVariant, ConnectionLineType, ReactFlow } from "@xyflow/react";
import { useEditorStore } from "@/state/editorStore";
import { nodeTypes } from "@components/nodes";

import "@xyflow/react/dist/style.css";

const defaultEdgeOptions = {
  type: "smoothstep",
  pathOptions: {
    borderRadius: 12,
    offset: 20,
  },
} as const;

export default function Canvas() {
  const nodes = useEditorStore((state) => state.nodes);
  const edges = useEditorStore((state) => state.edges);

  return (
    <div className="h-full w-full min-h-[300px] bg-white text-gray-900">
      <ReactFlow
        style={{ width: "100%", height: "100%" }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.Step}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView={true}
        onlyRenderVisibleElements={true}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
      </ReactFlow>
    </div>
  );
}
