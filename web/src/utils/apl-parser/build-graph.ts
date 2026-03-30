import { Position as FlowPosition, type Edge, type Node } from "@xyflow/react";
import { prettyCond } from "./pretty-log";
import type { Condition, IdentRef, Segment } from "./types";
import type { AplBlock, AplDocument, ParsedActionLine } from "./document";
import type {
  ActionGraphNodeKind,
  ActionNodeData,
  BlockNodeData,
  CallActionListNodeData,
  ConditionNodeData,
  GraphFlowNode,
  GraphNodeData,
  RootNodeData,
  SequenceNodeData,
  UseItemNodeData,
  ValueExpressionNodeData,
  VariableNodeData,
} from "@/components/nodes/types";

// Each node type lives in its own column, left to right: profile -> blocks -> actions -> conditions
// (exceptions exist, but per default this is the case)
const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 80;
const PROFILE_PADDING_ROWS = 2;
const EXPRESSION_NODE_BOUNDS = { width: 280, height: 48 } as const;
const DEFAULT_EDGE_STYLE = { stroke: "#6b7280" } as const;
const VALUE_EDGE_STYLE = { stroke: "#8b5cf6" } as const;
const DEFAULT_VARIABLE_OP = "set";
const UNNAMED_VARIABLE = "(unnamed)";
const MISSING_VALUE = "(no value)";
const UNNAMED_ITEM = "(unnamed item)";
const UNNAMED_ACTION_LIST = "(unnamed list)";

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

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
  style?: Edge["style"];
}

interface ConditionSegment {
  type: "if" | "target_if";
  expr: Condition;
}

interface SequenceSegment {
  type: "sequence";
  expr: Condition;
}

interface ExtractedVariableData {
  variableName: string;
  op: string;
  valueText: string;
}

function gridPoint(column: number, row: number): Point {
  return {
    x: column * COLUMN_WIDTH,
    y: row * ROW_HEIGHT,
  };
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
  const { sourceHandle, style } = options;

  return {
    id,
    source,
    target,
    sourceHandle,
    style: { ...DEFAULT_EDGE_STYLE, ...style },
  };
}

// Figures out how many rows tall a node is based on its pixel size (always at least 1)
function rowsFromBounds(bounds: Size): number {
  return Math.max(1, Math.ceil(bounds.height / ROW_HEIGHT));
}

function countActions(blocks: AplBlock[]): number {
  return blocks.reduce((total, block) => total + block.actions.length, 0);
}

function getConditionSegments(
  segments: Segment[],
): ConditionSegment[] {
  return segments.filter(
    (segment): segment is ConditionSegment =>
      segment.type === "if" || segment.type === "target_if",
  );
}

function findOtherSegment(
  segments: Segment[],
  key: string,
): Extract<Segment, { type: "other" }> | undefined {
  return segments.find(
    (segment): segment is Extract<Segment, { type: "other" }> =>
      segment.type === "other" && segment.key === key,
  );
}

function extractVariableData(segments: Segment[]): ExtractedVariableData {
  const nameSegment = findOtherSegment(segments, "name");
  const opSegment = findOtherSegment(segments, "op");
  const valueSegment = findOtherSegment(segments, "value");

  return {
    variableName: nameSegment ? prettyCond(nameSegment.expr) : UNNAMED_VARIABLE,
    op: opSegment ? prettyCond(opSegment.expr) : DEFAULT_VARIABLE_OP,
    valueText: valueSegment ? prettyCond(valueSegment.expr) : MISSING_VALUE,
  };
}

function extractCallTarget(segments: Segment[]): string {
  const targetSegment = findOtherSegment(segments, "name");
  return targetSegment ? prettyCond(targetSegment.expr) : UNNAMED_ACTION_LIST;
}

function extractUseItemName(segments: Segment[]): string {
  const nameSegment = findOtherSegment(segments, "name");
  if (nameSegment) {
    return prettyCond(nameSegment.expr);
  }

  const slotSegment =
    findOtherSegment(segments, "slot") ?? findOtherSegment(segments, "slots");
  if (slotSegment) {
    return prettyCond(slotSegment.expr);
  }

  return UNNAMED_ITEM;
}

function extractSequenceSpells(segments: Segment[]): string[] {
  const sequenceSegment = segments.find(
    (segment): segment is SequenceSegment => segment.type === "sequence",
  );

  if (sequenceSegment?.expr.kind !== "sequence") {
    return [];
  }

  return sequenceSegment.expr.expr.map((ident: IdentRef) => ident.name);
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

function buildExpressionNode(
  label: string,
  nodeId: string,
  origin: Point,
  kind: "condition" | "valueExpression",
): { nodes: GraphFlowNode[]; edges: Edge[]; bounds: Size } {
  const data: ConditionNodeData | ValueExpressionNodeData =
    kind === "condition"
      ? { label, kind: "condition" }
      : { label, kind: "valueExpression" };

  return {
    nodes: [createGraphNode(nodeId, data, origin)],
    edges: [],
    bounds: EXPRESSION_NODE_BOUNDS,
  };
}

/**
 * For now this just makes one node showing the condition as text.
 * Later this will break the condition apart into an AND/OR tree of smaller nodes,
 * but the function signature stays the same so nothing else needs to change.
 */
export function buildConditionGraph(
  condition: Condition,
  nodeId: string,
  origin: Point,
): { nodes: GraphFlowNode[]; edges: Edge[]; bounds: Size } {
  return buildExpressionNode(prettyCond(condition), nodeId, origin, "condition");
}

function buildValueExpressionGraph(
  label: string,
  nodeId: string,
  origin: Point,
): { nodes: GraphFlowNode[]; edges: Edge[]; bounds: Size } {
  return buildExpressionNode(label, nodeId, origin, "valueExpression");
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
    createGraphNode(actionId, actionNodeData, gridPoint(2, row)),
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
      gridPoint(3, row),
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
  for (let index = 0; index < conditionSegments.length; index++) {
    const segment = conditionSegments[index];
    const conditionRow = conditionStartRow + index;
    const conditionId =
      `condition__${profileId}__${blockName}__${String(actionIndex)}__${segment.type}`;
    const conditionGraph = buildConditionGraph(
      segment.expr,
      conditionId,
      gridPoint(3, conditionRow),
    );

    nodes.push(...conditionGraph.nodes);
    edges.push(...conditionGraph.edges);
    edges.push(
      createEdge(
        `edge__${actionId}__${segment.type}`,
        actionId,
        conditionGraph.nodes[0].id,
        actionNodeData.kind === "variable" ? { sourceHandle: "if" } : {},
      ),
    );

    rowsUsed = Math.max(
      rowsUsed,
      conditionRow - row + rowsFromBounds(conditionGraph.bounds),
    );
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
    createGraphNode(blockId, blockNodeData, gridPoint(1, startRow)),
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
    createGraphNode(rootId, rootNodeData, gridPoint(0, startRow)),
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

  return { nodes, edges };
}
