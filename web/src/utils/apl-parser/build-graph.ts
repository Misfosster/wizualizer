import { Position as FlowPosition, type Edge, type Node } from "@xyflow/react";
import type { AplBlock, AplDocument, ParsedActionLine } from "./document";
import {
  CONDITION_HANDLE_IDS,
  type ActionGraphNodeKind,
  type ActionNodeData,
  type BlockNodeData,
  type CallActionListNodeData,
  type ConditionHandleUsage,
  type GraphFlowNode,
  type GraphNodeData,
  type RootNodeData,
  type SequenceNodeData,
  type UseItemNodeData,
  type ValueExpressionNodeData,
  type VariableNodeData,
} from "@/components/nodes/types";
import {
  EXPRESSION_NODE_BOUNDS,
  PROFILE_PADDING_ROWS,
  gridPoint,
  rowsFromBounds,
  type Point,
  type Size,
} from "./grid-layout";
import {
  extractCallTarget,
  extractSequenceSpells,
  extractUseItemName,
  extractVariableData,
  getConditionSegments,
} from "./action-data";
import { placeConditionGraph } from "./condition-layout";
export type { Point, Size } from "./grid-layout";

const DEFAULT_EDGE_STYLE = { stroke: "#6b7280" } as const;
const VALUE_EDGE_STYLE = { stroke: "#8b5cf6" } as const;
const CONDITION_HANDLE_USAGE_KEYS = new Map<
  string,
  keyof ConditionHandleUsage
>([
  [CONDITION_HANDLE_IDS.targetLeft, "targetLeft"],
  [CONDITION_HANDLE_IDS.sourceRight, "sourceRight"],
  [CONDITION_HANDLE_IDS.targetTop, "targetTop"],
  [CONDITION_HANDLE_IDS.sourceBottom, "sourceBottom"],
]);

interface GraphSectionResult {
  nodes: GraphFlowNode[];
  edges: Edge[];
  rowsUsed: number;
}

export interface GraphResult {
  nodes: GraphFlowNode[];
  edges: Edge[];
}

interface EdgeOptions {
  sourceHandle?: string;
  targetHandle?: string;
  style?: Edge["style"];
}

export function getBlockNodeId(profileIndex: number, blockName: string): string {
  return `block__${String(profileIndex)}__${blockName}`;
}

function createNode<T extends GraphNodeData>(
  id: string,
  data: T,
  position: Point,
): Node<T, T["kind"]> {
  return {
    id,
    type: data.kind,
    position,
    data,
    sourcePosition: FlowPosition.Right,
    targetPosition: FlowPosition.Left,
  };
}

function createEdge(
  id: string,
  source: string,
  target: string,
  options: EdgeOptions = {},
): Edge {
  const { sourceHandle, targetHandle, style } = options;

  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    style: { ...DEFAULT_EDGE_STYLE, ...style },
  };
}

function markConditionHandleUsage(
  handleUsageByNode: Map<string, ConditionHandleUsage>,
  nodeId: string,
  handleId: string | null | undefined,
): void {
  if (!handleId) {
    return;
  }

  const key = CONDITION_HANDLE_USAGE_KEYS.get(handleId);
  if (!key) {
    return;
  }

  const handleUsage = handleUsageByNode.get(nodeId) ?? {};
  handleUsage[key] = true;
  handleUsageByNode.set(nodeId, handleUsage);
}

function withConditionHandleUsage(
  nodes: GraphFlowNode[],
  edges: Edge[],
): GraphFlowNode[] {
  const handleUsageByNode = new Map<string, ConditionHandleUsage>();

  for (const edge of edges) {
    markConditionHandleUsage(
      handleUsageByNode,
      edge.source,
      edge.sourceHandle,
    );
    markConditionHandleUsage(
      handleUsageByNode,
      edge.target,
      edge.targetHandle,
    );
  }

  return nodes.map((node) => {
    if (node.type !== "condition" && node.type !== "container") {
      return node;
    }

    const handleUsage = handleUsageByNode.get(node.id);
    return {
      ...node,
      data: {
        ...node.data,
        ...(handleUsage ? { handleUsage } : {}),
      },
    } as GraphFlowNode;
  });
}

function countActions(blocks: AplBlock[]): number {
  return blocks.reduce((total, block) => total + block.actions.length, 0);
}

export function getActionNodeKind(spell: string): ActionGraphNodeKind {
  switch (spell) {
    case "variable":
    case "cycling_variable":
      return "variable";
    case "use_item":
    case "use_items":
      return "useItem";
    case "call_action_list":
    case "run_action_list":
      return "callActionList";
    case "sequence":
    case "strict_sequence":
      return "sequence";
    default:
      return "action";
  }
}

function createActionNodeData(actionLine: ParsedActionLine):
  | ActionNodeData
  | VariableNodeData
  | UseItemNodeData
  | CallActionListNodeData
  | SequenceNodeData {
  const { action } = actionLine;
  const kind = getActionNodeKind(action.spell);
  const hasCondition = getConditionSegments(action.segments).length > 0;

  switch (kind) {
    case "variable": {
      const variableData = extractVariableData(action.segments);
      return {
        label: action.spell,
        kind: "variable",
        variableName: variableData.variableName,
        op: variableData.op,
        valueText: variableData.valueText,
      };
    }
    case "callActionList":
      return {
        label: action.spell,
        kind: "callActionList",
        targetList: extractCallTarget(action.segments),
      };
    case "useItem":
      return {
        label: action.spell,
        kind: "useItem",
        itemName: extractUseItemName(action.segments),
        hasCondition,
      };
    case "sequence":
      return {
        label: action.spell,
        kind: "sequence",
        spells: extractSequenceSpells(action.segments),
      };
    case "action":
      return {
        label: action.spell,
        kind: "action",
        hasCondition,
      };
    default:
      return assertNever(kind);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

function createGraphNode(
  id: string,
  data: GraphNodeData,
  position: Point,
): GraphFlowNode {
  return createNode(id, data, position) as GraphFlowNode;
}

function buildValueExpressionGraph(
  label: string,
  nodeId: string,
  origin: Point,
): { nodes: GraphFlowNode[]; edges: Edge[]; bounds: Size } {
  const data: ValueExpressionNodeData = { label, kind: "valueExpression" };
  return {
    nodes: [createGraphNode(nodeId, data, origin)],
    edges: [],
    bounds: EXPRESSION_NODE_BOUNDS,
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
  const actionNodeData = createActionNodeData(actionLine);
  const nodes: GraphFlowNode[] = [
    createGraphNode(actionId, actionNodeData, gridPoint("action", row)),
  ];
  const edges: Edge[] = [];
  let rowsUsed = 1;
  let conditionStartRow = row;

  if (actionNodeData.kind === "variable") {
    const valueExpressionId =
      `valueExpression__${profileId}__${blockName}__${String(actionIndex)}__value`;
    const valueExpressionGraph = buildValueExpressionGraph(
      actionNodeData.valueText,
      valueExpressionId,
      gridPoint("expression", row),
    );

    nodes.push(...valueExpressionGraph.nodes);
    edges.push(...valueExpressionGraph.edges);
    edges.push(
      createEdge(
        `edge__${actionId}__value`,
        actionId,
        valueExpressionGraph.nodes[0].id,
        { sourceHandle: "val", style: VALUE_EDGE_STYLE },
      ),
    );

    rowsUsed = Math.max(rowsUsed, rowsFromBounds(valueExpressionGraph.bounds));
    conditionStartRow = row + rowsFromBounds(valueExpressionGraph.bounds);
  }

  const conditionSegments = getConditionSegments(actionLine.action.segments);
  let conditionRowOffset = 0;

  for (const segment of conditionSegments) {
    const conditionRow = conditionStartRow + conditionRowOffset;
    const conditionId =
      `condition__${profileId}__${blockName}__${String(actionIndex)}__${segment.type}`;
    const conditionOrigin = gridPoint("expression", conditionRow);
    const conditionGraph = placeConditionGraph(
      segment.expr, conditionId, conditionOrigin.x, conditionOrigin.y,
    );

    nodes.push(...conditionGraph.nodes);
    edges.push(...conditionGraph.edges);
    edges.push(
      createEdge(
        `edge__${actionId}__${segment.type}`,
        actionId,
        conditionGraph.nodes[0].id,
        {
          ...(actionNodeData.kind === "variable" ? { sourceHandle: "if" } : {}),
          targetHandle: CONDITION_HANDLE_IDS.targetLeft,
        },
      ),
    );

    rowsUsed = Math.max(
      rowsUsed,
      conditionRow - row + conditionGraph.rowsUsed,
    );
    conditionRowOffset += conditionGraph.rowsUsed;
  }

  return { nodes, edges, rowsUsed };
}

function buildBlockGraph(
  block: AplBlock,
  profileIndex: number,
  rootId: string,
  startRow: number,
  collapsedBlocks: ReadonlySet<string>,
): GraphSectionResult {
  const blockId = getBlockNodeId(profileIndex, block.name);
  const blockNodeData: BlockNodeData = {
    label: block.name,
    kind: "block",
    actionCount: block.actions.length,
    isCollapsed: collapsedBlocks.has(blockId),
  };
  const nodes: GraphFlowNode[] = [
    createGraphNode(blockId, blockNodeData, gridPoint("block", startRow)),
  ];
  const edges: Edge[] = [
    createEdge(`edge__${rootId}__${block.name}`, rootId, blockId),
  ];

  if (blockNodeData.isCollapsed) {
    return { nodes, edges, rowsUsed: 1 };
  }

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
  collapsedBlocks: ReadonlySet<string>,
): GraphSectionResult {
  const rootId = `root__${String(profileIndex)}`;
  const rootNodeData: RootNodeData = {
    label: profileName,
    kind: "root",
    blockCount: blocks.length,
    actionCount: countActions(blocks),
  };
  const nodes: GraphFlowNode[] = [
    createGraphNode(rootId, rootNodeData, gridPoint("root", startRow)),
  ];
  const edges: Edge[] = [];

  let rowCursor = startRow;
  for (const block of blocks) {
    const blockGraph = buildBlockGraph(
      block,
      profileIndex,
      rootId,
      rowCursor,
      collapsedBlocks,
    );
    nodes.push(...blockGraph.nodes);
    edges.push(...blockGraph.edges);
    rowCursor += blockGraph.rowsUsed;
  }

  return { nodes, edges, rowsUsed: Math.max(1, rowCursor - startRow) };
}

export function buildGraph(
  document: AplDocument,
  collapsedBlocks: ReadonlySet<string> = new Set<string>(),
): GraphResult {
  const nodes: GraphFlowNode[] = [];
  const edges: Edge[] = [];
  let profileStartRow = 0;

  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    const profile = document.profiles[profileIndex];
    const profileGraph = buildProfileGraph(
      profileIndex,
      profile.name,
      profile.blocks,
      profileStartRow,
      collapsedBlocks,
    );

    nodes.push(...profileGraph.nodes);
    edges.push(...profileGraph.edges);
    profileStartRow += profileGraph.rowsUsed + PROFILE_PADDING_ROWS;
  }

  return { nodes: withConditionHandleUsage(nodes, edges), edges };
}
