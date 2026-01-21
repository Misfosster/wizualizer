import { useCallback } from "react";
import { ReactFlow } from "@xyflow/react";
import type { OnEdgesChange, OnConnect, OnNodesChange } from "@xyflow/react";
import { useEditorStore } from "@/state/store";

import "@xyflow/react/dist/style.css";
 
export default function Canvas() {
  const nodes = useEditorStore((state) => state.nodes);
  const edges = useEditorStore((state) => state.edges);
  const applyNodesChange = useEditorStore((state) => state.applyNodesChange);
  const applyEdgesChange = useEditorStore((state) => state.applyEdgesChange);
  const addConnection = useEditorStore((state) => state.addConnection);
 
  const onNodesChange: OnNodesChange = useCallback(
    // react flow sends a change list (move/select/delete), we apply it to our zustand store (state)
    (nodeChanges) => applyNodesChange(nodeChanges),
    [applyNodesChange],
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    // same idea for edges
    (edgeChanges) => applyEdgesChange(edgeChanges),
    [applyEdgesChange],
  );
  const onConnect: OnConnect = useCallback(
    // user created a new connection between nodes
    (newConnection) => addConnection(newConnection),
    [addConnection],
  );
 
  return (
    <div className="h-full w-full min-h-[300px] bg-white text-gray-900">
      <ReactFlow
        style={{ width: "100%", height: "100%" }}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView={true}
        onlyRenderVisibleElements={true}
      />
    </div>
  );
}
