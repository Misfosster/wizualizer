import { ReactFlow } from "@xyflow/react";
import { useEditorStore } from "@/state/editorStore";

import "@xyflow/react/dist/style.css";
 
export default function Canvas() {
  const nodes = useEditorStore((state) => state.nodes);
  const edges = useEditorStore((state) => state.edges);
 
  return (
    <div className="h-full w-full min-h-[300px] bg-white text-gray-900">
      <ReactFlow
        style={{ width: "100%", height: "100%" }}
        nodes={nodes}
        edges={edges}
        fitView={true}
        onlyRenderVisibleElements={true}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  );
}
