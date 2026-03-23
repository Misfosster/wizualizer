import type { Edge, Node } from "@xyflow/react";
import { prettyCond } from "./pretty-log";
import type { Condition, Segment } from "./types";
import type { AplBlock, AplDocument, ParsedActionLine } from "./document";

// Each node type lives in its own column, left to right: profile → blocks → actions → conditions
// (exceptions exist, but per default this is the case)
const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 80;
const PROFILE_PADDING_ROWS = 2;
const CONDITION_NODE_BOUNDS = { width: 280, height: 48 } as const;

type GraphNodeKind = "root" | "block" | "action" | "condition";

// React Flow needs node data to be a plain object
interface GraphNodeData extends Record<string, unknown> {
  label: string;
  kind: GraphNodeKind;
}

export interface Size {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

interface GraphSectionResult {
  nodes: Node[];
  edges: Edge[];
  rowsUsed: number;
}

export interface GraphResult {
  nodes: Node[];
  edges: Edge[];
}

function gridPoint(column: number, row: number): Position {
  return {
    x: column * COLUMN_WIDTH,
    y: row * ROW_HEIGHT,
  };
}

function createNode(
  id: string,
  label: string,
  kind: GraphNodeKind,
  position: Position,
): Node<GraphNodeData> {
  return {
    id,
    position,
    data: { label, kind },
  };
}

function createEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    style: { stroke: "#6b7280" },
  };
}

// Figures out how many rows tall a node is based on its pixel size (always at least 1)
function rowsFromBounds(bounds: Size): number {
  return Math.max(1, Math.ceil(bounds.height / ROW_HEIGHT));
}

function getConditionSegments(
  segments: Segment[],
): { expr: Condition; type: "if" | "target_if" }[] {
  return segments.filter(
    (segment): segment is Extract<Segment, { type: "if" | "target_if" }> =>
      segment.type === "if" || segment.type === "target_if",
  );
}

/**
 * For now this just makes one node showing the condition as text.
 * Later this will break the condition apart into an AND/OR tree of smaller nodes,
 * but the function signature stays the same so nothing else needs to change.
 */
export function buildConditionGraph(
  condition: Condition,
  nodeId: string,
  origin: Position,
): { nodes: Node[]; edges: Edge[]; bounds: Size } {
  return {
    nodes: [
      createNode(nodeId, prettyCond(condition), "condition", origin),
    ],
    edges: [],
    bounds: CONDITION_NODE_BOUNDS,
  };
}

function buildActionGraph(
  actionLine: ParsedActionLine,
  profileIndex: number,
  blockName: string,
  actionIndex: number,
  row: number,
): GraphSectionResult {
  const profileId = String(profileIndex);
  const actionId = `action__${profileId}__${blockName}__${String(actionIndex)}`;
  const nodes: Node[] = [
    createNode(actionId, actionLine.action.spell, "action", gridPoint(2, row)),
  ];
  const edges: Edge[] = [];
  let rowsUsed = 1;

  const conditionSegments = getConditionSegments(actionLine.action.segments);
  for (let index = 0; index < conditionSegments.length; index++) {
    const segment = conditionSegments[index];
    const conditionId =
      `condition__${profileId}__${blockName}__${String(actionIndex)}__${segment.type}`;
    const conditionGraph = buildConditionGraph(
      segment.expr,
      conditionId,
      gridPoint(3, row + index),
    );

    nodes.push(...conditionGraph.nodes);
    edges.push(...conditionGraph.edges);
    edges.push(
      createEdge(
        `edge__${actionId}__${segment.type}`,
        actionId,
        conditionGraph.nodes[0].id,
      ),
    );

    rowsUsed = Math.max(
      rowsUsed,
      index + rowsFromBounds(conditionGraph.bounds),
    );
  }

  return { nodes, edges, rowsUsed };
}

function buildBlockGraph(
  block: AplBlock,
  profileIndex: number,
  rootId: string,
  startRow: number,
): GraphSectionResult {
  const profileId = String(profileIndex);
  const blockId = `block__${profileId}__${block.name}`;
  const nodes: Node[] = [
    createNode(blockId, block.name, "block", gridPoint(1, startRow)),
  ];
  const edges: Edge[] = [
    createEdge(`edge__${rootId}__${block.name}`, rootId, blockId),
  ];

  // Start placing actions one row under the block header
  let rowCursor = startRow + 1;
  for (let actionIndex = 0; actionIndex < block.actions.length; actionIndex++) {
    const actionGraph = buildActionGraph(
      block.actions[actionIndex],
      profileIndex,
      block.name,
      actionIndex,
      rowCursor,
    );

    nodes.push(...actionGraph.nodes);
    edges.push(
      createEdge(
        `edge__${blockId}__${String(actionIndex)}`,
        blockId,
        actionGraph.nodes[0].id,
      ),
    );
    edges.push(...actionGraph.edges);
    rowCursor += actionGraph.rowsUsed;
  }

  return { nodes, edges, rowsUsed: Math.max(1, rowCursor - startRow) };
}

function buildProfileGraph(
  profileIndex: number,
  profileName: string,
  blocks: AplBlock[],
  startRow: number,
): GraphSectionResult {
  const rootId = `root__${String(profileIndex)}`;
  const nodes: Node[] = [
    createNode(rootId, profileName, "root", gridPoint(0, startRow)),
  ];
  const edges: Edge[] = [];

  let rowCursor = startRow;
  for (const block of blocks) {
    const blockGraph = buildBlockGraph(block, profileIndex, rootId, rowCursor);
    nodes.push(...blockGraph.nodes);
    edges.push(...blockGraph.edges);
    rowCursor += blockGraph.rowsUsed;
  }

  return { nodes, edges, rowsUsed: Math.max(1, rowCursor - startRow) };
}

export function buildGraph(document: AplDocument): GraphResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let profileStartRow = 0;

  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    const profile = document.profiles[profileIndex];
    const profileGraph = buildProfileGraph(
      profileIndex,
      profile.name,
      profile.blocks,
      profileStartRow,
    );

    nodes.push(...profileGraph.nodes);
    edges.push(...profileGraph.edges);
    profileStartRow += profileGraph.rowsUsed + PROFILE_PADDING_ROWS;
  }

  return { nodes, edges };
}
