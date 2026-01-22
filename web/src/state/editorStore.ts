import { create } from "zustand";
import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
} from "@xyflow/react";

export const APL_STORAGE_KEY = "logiccraft.aplText";

const initialNodes: Node[] = [
  { id: "n1", position: { x: 0, y: 0 }, data: { label: "Node 1" } },
  { id: "n2", position: { x: 0, y: 100 }, data: { label: "Node 2" } },
];

const initialEdges: Edge[] = [{ id: "n1-n2", source: "n1", target: "n2" }];

interface EditorState {
  aplText: string;
  // update text from the textarea
  setAplText: (aplText: string) => void;
  nodes: Node[];
  edges: Edge[];
  // apply changes from react flow to the nodes and edges
  applyNodesChange: (nodeChanges: NodeChange[]) => void;
  applyEdgesChange: (edgeChanges: EdgeChange[]) => void;
  // add a new edge when the user connects two nodes
  addConnection: (connection: Connection) => void;
};

const getInitialAplText = () => {
  // guard for non-browser environments
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(APL_STORAGE_KEY) ?? "";
};

export const useEditorStore = create<EditorState>((set) => ({
  aplText: getInitialAplText(),
  setAplText: (aplText) => {
    set({ aplText });
  },
  nodes: initialNodes,
  edges: initialEdges,
  applyNodesChange: (nodeChanges) => {
    set((state) => ({ nodes: applyNodeChanges(nodeChanges, state.nodes) }));
  },
  applyEdgesChange: (edgeChanges) => {
    set((state) => ({ edges: applyEdgeChanges(edgeChanges, state.edges) }));
  },
  addConnection: (connection) => {
    set((state) => ({ edges: addEdge(connection, state.edges) }));
  },
}));
