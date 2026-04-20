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
import type {
  TalentRenderMode,
  TalentRenderSummary,
  TalentSelectionResult,
  TalentState,
} from "@/utils/talents/types";
import type { ConditionOverrides } from "@/utils/conditions/types";
import type { AtomResolver } from "@/utils/talents/evaluate-condition";
import { simplifyConditionForRender } from "@/utils/talents/simplify-condition";
import {
  EXPRESSION_NODE_BOUNDS,
  PROFILE_PADDING_ROWS,
  gridPoint,
  rowsFromBounds,
  type Point,
} from "./grid-layout";
import {
  extractCallTarget,
  extractSequenceSpells,
  extractUseItemName,
  extractVariableData,
  getConditionSegments,
} from "./action-data";
import {
  placeConditionGraph,
  placeValueExpressionGraph,
  type ConditionGraphResult,
} from "./condition-layout";
import {
  getActionNodeId,
  getBlockNodeId,
  getRootNodeId,
} from "./node-ids";
import {
  buildTalentRenderContext,
  getActionTalentState,
  getSurvivingActionIndices,
  shouldKeepBlockInHide,
  type TalentRenderContext,
} from "./talent-rendering";
export type { Point, Size } from "./grid-layout";
export { getActionNodeId, getBlockNodeId, getRootNodeId } from "./node-ids";

const DEFAULT_EDGE_STYLE = { stroke: "#6b7280" } as const;
const VALUE_EDGE_STYLE = { stroke: "#8b5cf6" } as const;
// Faded gray with reduced opacity for edges that touch a talent-impossible
// action in Dim mode. Keeps the visual hierarchy correct: a dimmed action
// should not anchor a fully bright connector.
const IMPOSSIBLE_EDGE_STYLE = { stroke: "#9ca3af", opacity: 0.4 } as const;
const NODE_BORDER_HEIGHT = 2;
const NODE_VERTICAL_PADDING = 24;
const NODE_HEADER_HEIGHT = 40;
const NODE_NOTE_GAP = 12;
const NODE_NOTE_LINE_HEIGHT = 16;
const NODE_META_PILL_HEIGHT = 22;
const ACTION_SECTION_GAP_ROWS = 0.5;
const NODE_Z_INDEX: Record<GraphNodeData["kind"], number> = {
  root: 50,
  block: 40,
  action: 30,
  variable: 30,
  useItem: 30,
  callActionList: 30,
  sequence: 30,
  condition: 20,
  valueExpression: 20,
  container: 10,
};
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
  /**
   * Present when `buildGraph` was invoked with a non-`off` `talentRenderMode`.
   * The editor surface uses this to render the per-profile "N actions hidden"
   * row inside the talent panel. Absent in Off mode so the surrounding code
   * can treat its presence as an "explicitly filtered build" signal.
   */
  talentSummary?: TalentRenderSummary;
}

/**
 * Optional inputs for the talent-aware passes. Defaults preserve the old
 * behavior exactly (Off mode, no selections), so existing callers do not need
 * to change.
 */
export interface BuildGraphOptions {
  talentRenderMode?: TalentRenderMode;
  talentSelectionsByProfile?: ReadonlyMap<number, TalentSelectionResult>;
  /**
   * Manual override panel state. Defaults to no overrides, in which
   * case behaviour is identical to the talents-only flow.
   */
  conditionOverrides?: ConditionOverrides;
}

interface EdgeOptions {
  sourceHandle?: string;
  targetHandle?: string;
  style?: Edge["style"];
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
    zIndex: NODE_Z_INDEX[data.kind],
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

// Subtree nodes (condition / valueExpression / container) belong to a single
// action. When that action is impossible in Dim mode, every descendant gets
// the same `talentState` so the renderers can fade the whole subtree together.
function withSubtreeTalentState(
  nodes: GraphFlowNode[],
  talentState: TalentState | undefined,
  talentReason: string | undefined,
): GraphFlowNode[] {
  if (!talentState) {
    return nodes;
  }

  return nodes.map((node) => {
    if (
      node.type !== "condition" &&
      node.type !== "valueExpression" &&
      node.type !== "container"
    ) {
      return node;
    }

    return {
      ...node,
      data: {
        ...node.data,
        talentState,
        ...(talentReason ? { talentReason } : {}),
      },
    } as GraphFlowNode;
  });
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
    if (
      node.type !== "condition" &&
      node.type !== "container" &&
      node.type !== "valueExpression"
    ) {
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

function createActionNodeData(
  actionLine: ParsedActionLine,
  conditionCount: number,
  isCollapsed: boolean,
  talentState: TalentState | undefined,
  talentReason: string | undefined,
):
  | ActionNodeData
  | VariableNodeData
  | UseItemNodeData
  | CallActionListNodeData
  | SequenceNodeData {
  const { action } = actionLine;
  const kind = getActionNodeKind(action.spell);
  const hasCondition = conditionCount > 0;
  const hasChildren = kind === "variable" || hasCondition;
  const collapseData = {
    hasCondition,
    hasChildren,
    isCollapsed: hasChildren && isCollapsed,
  };
  const talentData = talentState
    ? { talentState, ...(talentReason ? { talentReason } : {}) }
    : {};

  switch (kind) {
    case "variable": {
      const variableData = extractVariableData(action.segments);
      return {
        label: action.spell,
        kind: "variable",
        ...collapseData,
        ...talentData,
        variableName: variableData.variableName,
        op: variableData.op,
        hasExplicitOp: variableData.hasExplicitOp,
        valueText: variableData.valueText,
      };
    }
    case "callActionList":
      return {
        label: action.spell,
        kind: "callActionList",
        ...collapseData,
        ...talentData,
        targetList: extractCallTarget(action.segments),
      };
    case "useItem":
      return {
        label: action.spell,
        kind: "useItem",
        ...collapseData,
        ...talentData,
        itemName: extractUseItemName(action.segments),
      };
    case "sequence":
      return {
        label: action.spell,
        kind: "sequence",
        ...collapseData,
        ...talentData,
        spells: extractSequenceSpells(action.segments),
      };
    case "action":
      return {
        label: action.spell,
        kind: "action",
        ...collapseData,
        ...talentData,
      };
    default:
      return assertNever(kind);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

function estimateDefaultSourceCenterY(data: GraphNodeData): number {
  let height = NODE_BORDER_HEIGHT + NODE_VERTICAL_PADDING + NODE_HEADER_HEIGHT;

  if (
    data.kind === "useItem" ||
    data.kind === "callActionList" ||
    data.kind === "sequence"
  ) {
    height += NODE_NOTE_GAP + NODE_NOTE_LINE_HEIGHT;
  }

  return height / 2;
}

function estimateVariableValueSourceCenterY(
  data: Extract<GraphNodeData, { kind: "variable" }>,
): number {
  let height = NODE_BORDER_HEIGHT + NODE_VERTICAL_PADDING + NODE_HEADER_HEIGHT;

  if (data.hasExplicitOp) {
    height += NODE_NOTE_GAP + NODE_META_PILL_HEIGHT;
  }

  return data.hasCondition ? height * 0.34 : height / 2;
}

function createGraphNode(
  id: string,
  data: GraphNodeData,
  position: Point,
  extra?: Partial<Node>,
): GraphFlowNode {
  return { ...createNode(id, data, position), ...extra } as GraphFlowNode;
}

function buildValueExpressionGraph(
  label: string,
  nodeId: string,
  origin: Point,
): ConditionGraphResult {
  const data: ValueExpressionNodeData = { label, kind: "valueExpression" };
  return {
    nodes: [
      createGraphNode(nodeId, data, origin, {
        style: { width: EXPRESSION_NODE_BOUNDS.width },
      }),
    ],
    edges: [],
    size: EXPRESSION_NODE_BOUNDS,
    rowsUsed: rowsFromBounds(EXPRESSION_NODE_BOUNDS),
    entryNodeId: nodeId,
    entryCenterY: EXPRESSION_NODE_BOUNDS.height / 2,
  };
}

function buildVariableValueExpressionGraph(
  actionLine: ParsedActionLine,
  actionNodeData: Extract<GraphNodeData, { kind: "variable" }>,
  nodeId: string,
  origin: Point,
): ConditionGraphResult {
  const variableData = extractVariableData(actionLine.action.segments);
  if (!variableData.valueExpr) {
    return buildValueExpressionGraph(actionNodeData.valueText, nodeId, origin);
  }

  return placeValueExpressionGraph(
    variableData.valueExpr,
    nodeId,
    origin.x,
    origin.y,
  );
}

function buildActionGraph(
  actionLine: ParsedActionLine,
  profileIndex: number,
  blockName: string,
  actionIndex: number,
  row: number,
  collapsedActions: ReadonlySet<string>,
  talentState: TalentState | undefined,
  talentReason: string | undefined,
  resolveAtomForRender: AtomResolver | undefined,
  simplifyConditionsForRender: boolean,
): GraphSectionResult {
  const actionId = getActionNodeId(profileIndex, blockName, actionIndex);
  const profileId = String(profileIndex);
  const conditionSegments = getConditionSegments(actionLine.action.segments);
  const renderedConditionSegments =
    simplifyConditionsForRender && resolveAtomForRender !== undefined
      ? conditionSegments.flatMap((segment) => {
          const simplified = simplifyConditionForRender(
            segment.expr,
            resolveAtomForRender,
          );
          if (!simplified) {
            return [];
          }
          return [{ ...segment, expr: simplified }];
        })
      : conditionSegments;
  const actionNodeData = createActionNodeData(
    actionLine,
    renderedConditionSegments.length,
    collapsedActions.has(actionId),
    talentState,
    talentReason,
  );
  const isImpossible = talentState === "impossible";
  const childEdgeStyle: Edge["style"] | undefined = isImpossible
    ? IMPOSSIBLE_EDGE_STYLE
    : undefined;
  const nodes: GraphFlowNode[] = [
    createGraphNode(actionId, actionNodeData, gridPoint("action", row)),
  ];
  const edges: Edge[] = [];
  let rowsUsed = 1;
  let conditionStartRow = row;
  let didAlignActionToCondition = false;
  const shouldBuildChildren =
    actionNodeData.hasChildren && !actionNodeData.isCollapsed;

  function alignActionToConditionEntry(
    conditionOrigin: Point,
    conditionGraph: ConditionGraphResult,
  ): void {
    if (actionNodeData.kind === "variable" || didAlignActionToCondition) {
      return;
    }

    didAlignActionToCondition = true;
    const currentAction = nodes[0];
    nodes[0] = {
      ...currentAction,
      position: {
        ...currentAction.position,
        y:
          conditionOrigin.y +
          conditionGraph.entryCenterY -
          estimateDefaultSourceCenterY(actionNodeData),
      },
    };
  }

  if (actionNodeData.kind === "variable" && shouldBuildChildren) {
    const valueExpressionId =
      `valueExpression__${profileId}__${blockName}__${String(actionIndex)}__value`;
    const valueExpressionOrigin = gridPoint("expression", row);
    const valueExpressionGraph = buildVariableValueExpressionGraph(
      actionLine,
      actionNodeData,
      valueExpressionId,
      valueExpressionOrigin,
    );
    const valueExpressionYOffset = Math.round(
      estimateVariableValueSourceCenterY(actionNodeData) -
      valueExpressionGraph.entryCenterY,
    );
    valueExpressionGraph.nodes = valueExpressionGraph.nodes.map((node) => ({
      ...node,
      position: {
        ...node.position,
        y: node.parentId
          ? node.position.y
          : node.position.y + valueExpressionYOffset,
      },
    }));

    nodes.push(
      ...withSubtreeTalentState(
        valueExpressionGraph.nodes,
        talentState,
        talentReason,
      ),
    );
    edges.push(...valueExpressionGraph.edges);
    edges.push(
      createEdge(
        `edge__${actionId}__value`,
        actionId,
        valueExpressionGraph.entryNodeId,
        {
          sourceHandle: "val",
          targetHandle: CONDITION_HANDLE_IDS.targetLeft,
          style: { ...VALUE_EDGE_STYLE, ...(childEdgeStyle ?? {}) },
        },
      ),
    );

    rowsUsed = Math.max(rowsUsed, valueExpressionGraph.rowsUsed);
    conditionStartRow = row + valueExpressionGraph.rowsUsed;
  }

  let conditionRowOffset = 0;

  for (const segment of shouldBuildChildren ? renderedConditionSegments : []) {
    const conditionRow = conditionStartRow + conditionRowOffset;
    const conditionId =
      `condition__${profileId}__${blockName}__${String(actionIndex)}__${segment.type}`;
    const conditionOrigin = gridPoint("expression", conditionRow);
    const conditionGraph = placeConditionGraph(
      segment.expr,
      conditionId,
      conditionOrigin.x,
      conditionOrigin.y,
    );
    alignActionToConditionEntry(conditionOrigin, conditionGraph);

    nodes.push(
      ...withSubtreeTalentState(
        conditionGraph.nodes,
        talentState,
        talentReason,
      ),
    );
    edges.push(...conditionGraph.edges);
    edges.push(
      createEdge(
        `edge__${actionId}__${segment.type}`,
        actionId,
        conditionGraph.entryNodeId,
        {
          ...(actionNodeData.kind === "variable" ? { sourceHandle: "if" } : {}),
          targetHandle: CONDITION_HANDLE_IDS.targetLeft,
          ...(childEdgeStyle ? { style: childEdgeStyle } : {}),
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
  collapsedActions: ReadonlySet<string>,
  context: TalentRenderContext,
): GraphSectionResult | null {
  const survivingIndices = getSurvivingActionIndices(
    block,
    profileIndex,
    context,
  );

  if (!shouldKeepBlockInHide(block, profileIndex, context, survivingIndices.length)) {
    return null;
  }

  const blockId = getBlockNodeId(profileIndex, block.name);
  // In Hide mode, surfaced counts must match what the user actually sees.
  // In Off and Dim, all actions are present, so the source count is correct.
  const visibleActionCount =
    context.mode === "hide" ? survivingIndices.length : block.actions.length;
  const blockNodeData: BlockNodeData = {
    label: block.name,
    kind: "block",
    actionCount: visibleActionCount,
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

  const resolveAtomForRender = context.profileAtomResolvers.get(profileIndex);
  const simplifyConditionsForRender = context.mode !== "off";

  // Start placing actions one row under the block header
  let rowCursor = startRow + 1;
  for (let i = 0; i < survivingIndices.length; i++) {
    const actionIndex = survivingIndices[i];
    const talentState = getActionTalentState(
      profileIndex,
      block.name,
      actionIndex,
      context,
    );
    const actionId = getActionNodeId(profileIndex, block.name, actionIndex);
    const talentReason =
      talentState === "impossible"
        ? context.hiddenActionById.get(actionId)?.reasonLabel
        : undefined;
    const actionGraph = buildActionGraph(
      block.actions[actionIndex],
      profileIndex,
      block.name,
      actionIndex,
      rowCursor,
      collapsedActions,
      talentState,
      talentReason,
      resolveAtomForRender,
      simplifyConditionsForRender,
    );

    nodes.push(...actionGraph.nodes);
    edges.push(
      createEdge(
        `edge__${blockId}__${String(actionIndex)}`,
        blockId,
        actionGraph.nodes[0].id,
        talentState === "impossible"
          ? { style: IMPOSSIBLE_EDGE_STYLE }
          : {},
      ),
    );
    edges.push(...actionGraph.edges);
    rowCursor += actionGraph.rowsUsed;
    if (i < survivingIndices.length - 1) {
      rowCursor += ACTION_SECTION_GAP_ROWS;
    }
  }

  return { nodes, edges, rowsUsed: Math.max(1, rowCursor - startRow) };
}

function buildProfileGraph(
  profileIndex: number,
  profileName: string,
  blocks: AplBlock[],
  startRow: number,
  collapsedBlocks: ReadonlySet<string>,
  collapsedActions: ReadonlySet<string>,
  context: TalentRenderContext,
): GraphSectionResult | null {
  // Build blocks first; in Hide mode some may be skipped entirely. We need to
  // know that before deciding whether the profile root should appear at all.
  const blockGraphs: GraphSectionResult[] = [];
  let rowCursor = startRow;

  for (const block of blocks) {
    const blockGraph = buildBlockGraph(
      block,
      profileIndex,
      getRootNodeId(profileIndex),
      rowCursor,
      collapsedBlocks,
      collapsedActions,
      context,
    );
    if (!blockGraph) {
      continue;
    }
    blockGraphs.push(blockGraph);
    rowCursor += blockGraph.rowsUsed;
  }

  if (context.mode === "hide" && blockGraphs.length === 0) {
    return null;
  }

  const rootId = getRootNodeId(profileIndex);
  const rootNodeData: RootNodeData = {
    label: profileName,
    kind: "root",
    blockCount:
      context.mode === "hide" ? blockGraphs.length : blocks.length,
    actionCount:
      context.mode === "hide"
        ? blockGraphs.reduce(
            (total, blockGraph) =>
              total + (blockGraph.nodes[0].data as BlockNodeData).actionCount,
            0,
          )
        : countActions(blocks),
  };
  const nodes: GraphFlowNode[] = [
    createGraphNode(rootId, rootNodeData, gridPoint("root", startRow)),
  ];
  const edges: Edge[] = [];

  for (const blockGraph of blockGraphs) {
    nodes.push(...blockGraph.nodes);
    edges.push(...blockGraph.edges);
  }

  return { nodes, edges, rowsUsed: Math.max(1, rowCursor - startRow) };
}

export function buildGraph(
  document: AplDocument,
  collapsedBlocks: ReadonlySet<string> = new Set<string>(),
  collapsedActions: ReadonlySet<string> = new Set<string>(),
  options: BuildGraphOptions = {},
): GraphResult {
  const mode: TalentRenderMode = options.talentRenderMode ?? "off";
  const context = buildTalentRenderContext(
    document,
    mode,
    options.talentSelectionsByProfile,
    options.conditionOverrides,
  );
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
      collapsedActions,
      context,
    );

    if (!profileGraph) {
      // Hide eliminated this profile entirely: do not emit a root, do not
      // reserve PROFILE_PADDING_ROWS so the layout compacts.
      continue;
    }

    nodes.push(...profileGraph.nodes);
    edges.push(...profileGraph.edges);
    profileStartRow += profileGraph.rowsUsed + PROFILE_PADDING_ROWS;
  }

  const result: GraphResult = {
    nodes: withConditionHandleUsage(nodes, edges),
    edges,
  };

  if (mode !== "off") {
    result.talentSummary = {
      hiddenActionCountByProfile: context.hiddenCountByProfile,
      hiddenActionsByProfile: context.hiddenActionsByProfile,
    };
  }

  return result;
}
