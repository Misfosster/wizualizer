import { Position as FlowPosition, type Edge, type Node } from "@xyflow/react";
import { getConditionSource } from "./condition-source";
import { prettyCond } from "./pretty-log";
import type { BinOp, Condition } from "./types";
import { BOOLEAN_CHAIN_OPS, flattenBooleanChain } from "./action-data";
import type { AtomResolver } from "@/utils/talents/evaluate-condition";
import { getProvableTruthiness } from "@/utils/talents/simplify-condition";
import { ROW_HEIGHT } from "./grid-layout";
import type {
  ConditionExpressionKind,
  ConditionNodeData,
  ContainerNodeData,
  GraphFlowNode,
  GraphNodeData,
  ValueExpressionNodeData,
} from "@/components/nodes/types";
import { CONDITION_HANDLE_IDS } from "@/components/nodes/types";
import type { Size } from "./grid-layout";

/** Optional atom-driven styling while placing a condition subgraph. */
export interface ConditionGraphAtomAnnotations {
  /** Condition-filter toggle: marks leaves provably true. */
  dimTrueLeafResolver?: AtomResolver;
  /**
   * Talent-render Dim mode: fades subgraphs whose root expression is provably
   * false under decode/overrides while the enclosing action may still survive
   * (e.g. dead AND arm under a top-level OR).
   */
  decodeFalseBranchResolver?: AtomResolver;
}

function withDecodeFalseIfProvedSubtree(
  result: ConditionGraphResult,
  subtreeRootCondition: Condition,
  annotations: ConditionGraphAtomAnnotations | undefined,
): ConditionGraphResult {
  const resolver = annotations?.decodeFalseBranchResolver;
  if (
    !resolver ||
    getProvableTruthiness(subtreeRootCondition, resolver) !== "false"
  ) {
    return result;
  }

  return {
    ...result,
    nodes: result.nodes.map((node) =>
      annotateDecodeFalseOnGraphNode(node),
    ),
  };
}

function annotateDecodeFalseOnGraphNode(node: GraphFlowNode): GraphFlowNode {
  if (
    node.type !== "condition" &&
    node.type !== "container" &&
    node.type !== "valueExpression"
  ) {
    return node;
  }

  return {
    ...node,
    data: {
      ...node.data,
      decodeProvedFalse: true,
    },
  } as GraphFlowNode;
}

const CONDITION_MIN_WIDTH = 220;
const CONDITION_CELL: Readonly<Size> = {
  width: CONDITION_MIN_WIDTH,
  height: 66,
};
const CONDITION_TEXT_PADDING = 36;
const CONDITION_CHAR_WIDTH = 7.6;
const AND_GAP = 96;
const OR_GAP = 48;
const CONTAINER_PADDING = 20;
const COMPARISON_OPS: ReadonlySet<BinOp> = new Set([
  "<",
  "<=",
  ">",
  ">=",
  "=",
  "==",
  "!=",
  "~",
  "!~",
]);
const ARITHMETIC_OPS: ReadonlySet<BinOp> = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "%%",
  "<?",
  ">?",
]);

const DEFAULT_EDGE_STYLE = { stroke: "#7b8494" } as const;
const NODE_Z_INDEX: Record<GraphNodeData["kind"], number> = {
  root: 50,
  block: 40,
  action: 30,
  variable: 30,
  useItem: 30,
  callActionList: 30,
  sequence: 30,
  condition: 20,
  targetRanking: 20,
  valueExpression: 20,
  container: 10,
};
const BOOLEAN_EDGE_COLORS: Record<
  BooleanEdgeOperator,
  { stroke: string; label: string; labelBg: string }
> = {
  AND: { stroke: "#6fc2c9", label: "rgba(223, 247, 248, 0.78)", labelBg: "#263e44" },
  OR: { stroke: "rgba(122, 167, 255, 0.62)", label: "rgba(232, 240, 255, 0.68)", labelBg: "#26344d" },
  XOR: { stroke: "rgba(181, 164, 255, 0.62)", label: "rgba(240, 237, 255, 0.68)", labelBg: "#352d55" },
};

type BooleanEdgeOperator = "AND" | "OR" | "XOR";
type ExpressionLeafKind = "condition" | "valueExpression";

interface ConditionMeasure {
  width: number;
  height: number;
}

type ConditionMeasureCacheKey = `${0 | 1}:${0 | 1}`;

interface EdgeOptions {
  label?: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: Edge["type"];
  style?: Edge["style"];
  labelStyle?: Edge["labelStyle"];
  labelBgStyle?: Edge["labelBgStyle"];
  labelBgPadding?: Edge["labelBgPadding"];
  labelBgBorderRadius?: Edge["labelBgBorderRadius"];
}

type GraphNodeExtra = Pick<
  Node,
  "className" | "extent" | "parentId" | "style"
>;

export interface ConditionGraphResult {
  nodes: GraphFlowNode[];
  edges: Edge[];
  size: Size;
  rowsUsed: number;
  entryNodeId: string;
  entryCenterY: number;
}

const conditionMeasureCache = new WeakMap<
  Condition,
  Map<ConditionMeasureCacheKey, ConditionMeasure>
>();

function getConditionMeasureCacheKey(
  wrapAndInContainer: boolean,
  elideOrGroup: boolean,
): ConditionMeasureCacheKey {
  if (wrapAndInContainer) {
    return elideOrGroup ? "1:1" : "1:0";
  }

  return elideOrGroup ? "0:1" : "0:0";
}

function measureCondition(
  condition: Condition,
  wrapAndInContainer = false,
  elideOrGroup = false,
): ConditionMeasure {
  const cacheKey = getConditionMeasureCacheKey(
    wrapAndInContainer,
    elideOrGroup,
  );
  const cachedMeasure = conditionMeasureCache.get(condition)?.get(cacheKey);
  if (cachedMeasure) {
    return cachedMeasure;
  }

  const measured = measureConditionUncached(
    condition,
    wrapAndInContainer,
    elideOrGroup,
  );
  const cachedMeasures =
    conditionMeasureCache.get(condition) ??
    new Map<ConditionMeasureCacheKey, ConditionMeasure>();
  cachedMeasures.set(cacheKey, measured);
  conditionMeasureCache.set(condition, cachedMeasures);

  return measured;
}

function measureConditionUncached(
  condition: Condition,
  wrapAndInContainer: boolean,
  elideOrGroup: boolean,
): ConditionMeasure {
  if (condition.kind === "paren") {
    if (
      shouldElideGroupContainer(
        condition,
        wrapAndInContainer,
        elideOrGroup,
      )
    ) {
      return measureCondition(
        condition.expr,
        wrapAndInContainer,
        elideOrGroup,
      );
    }

    const inner = measureCondition(condition.expr);
    return {
      width: inner.width + CONTAINER_PADDING * 2,
      height: inner.height + CONTAINER_PADDING * 2,
    };
  }

  if (condition.kind === "binary" && BOOLEAN_CHAIN_OPS.has(condition.op)) {
    const operands = flattenBooleanChain(condition);

    if (condition.op === "&") {
      const childMeasures = operands.map((operand) =>
        measureCondition(operand),
      );
      const totalWidth =
        childMeasures.reduce((sum, m) => sum + m.width, 0) +
        AND_GAP * (childMeasures.length - 1);
      const maxHeight = Math.max(...childMeasures.map((m) => m.height));
      if (!wrapAndInContainer) {
        return { width: totalWidth, height: maxHeight };
      }
      return {
        width: totalWidth + CONTAINER_PADDING * 2,
        height: maxHeight + CONTAINER_PADDING * 2,
      };
    }

    const childMeasures = operands.map((operand) =>
      measureCondition(operand, true),
    );
    const maxChildWidth = Math.max(...childMeasures.map((m) => m.width));
    const totalHeight =
      childMeasures.reduce((sum, m) => sum + m.height, 0) +
      OR_GAP * (childMeasures.length - 1);
    return { width: maxChildWidth, height: totalHeight };
  }

  return measureLeafCondition(condition);
}

function measureLeafCondition(condition: Condition): ConditionMeasure {
  const label = conditionLabel(condition);
  return {
    width: Math.ceil(
      Math.max(
        CONDITION_MIN_WIDTH,
        label.length * CONDITION_CHAR_WIDTH + CONDITION_TEXT_PADDING,
      ),
    ),
    height: CONDITION_CELL.height,
  };
}

function shouldElideGroupContainer(
  condition: Condition & { kind: "paren" },
  wrapAndInContainer: boolean,
  elideOrGroup: boolean,
): boolean {
  if (!isLogicalCondition(condition.expr)) {
    return true;
  }

  if (condition.expr.op === "&" && wrapAndInContainer) {
    return true;
  }

  return elideOrGroup;
}

function isLogicalCondition(condition: Condition): condition is Condition & {
  kind: "binary";
} {
  return condition.kind === "binary" && BOOLEAN_CHAIN_OPS.has(condition.op);
}

function conditionLabel(condition: Condition): string {
  return getConditionSource(condition) ?? prettyCond(condition);
}

function conditionExpressionKind(
  condition: Condition,
): ConditionExpressionKind {
  if (condition.kind === "binary" && COMPARISON_OPS.has(condition.op)) {
    return "comparison";
  }

  if (condition.kind === "binary" && ARITHMETIC_OPS.has(condition.op)) {
    return "arithmetic";
  }

  return "expression";
}

function graphNodeClassName(
  data: GraphNodeData,
  extra?: Partial<GraphNodeExtra>,
): string | undefined {
  const classNames = [
    typeof extra?.className === "string" ? extra.className : undefined,
    extra?.parentId ? "lc-flow-node--nested" : undefined,
    data.kind === "container" ? "lc-flow-node--container" : undefined,
  ].filter(Boolean);

  return classNames.length > 0 ? classNames.join(" ") : undefined;
}

function createGraphNode(
  id: string,
  data: GraphNodeData,
  position: { x: number; y: number },
  extra?: Partial<GraphNodeExtra>,
): GraphFlowNode {
  const className = graphNodeClassName(data, extra);

  return {
    id,
    type: data.kind,
    position,
    data,
    sourcePosition: FlowPosition.Right,
    targetPosition: FlowPosition.Left,
    zIndex: NODE_Z_INDEX[data.kind],
    ...extra,
    ...(className ? { className } : {}),
  } as GraphFlowNode;
}

function createEdge(
  id: string,
  source: string,
  target: string,
  options: EdgeOptions = {},
): Edge {
  return {
    id,
    source,
    target,
    label: options.label,
    sourceHandle: options.sourceHandle,
    targetHandle: options.targetHandle,
    type: options.type,
    style: { ...DEFAULT_EDGE_STYLE, ...options.style },
    labelStyle: options.labelStyle,
    labelBgStyle: options.labelBgStyle,
    labelBgPadding: options.labelBgPadding,
    labelBgBorderRadius: options.labelBgBorderRadius,
  };
}

function createBooleanEdge(
  id: string,
  source: string,
  target: string,
  operator: BooleanEdgeOperator,
): Edge {
  const colors = BOOLEAN_EDGE_COLORS[operator];

  return createEdge(id, source, target, {
    label: operator,
    type: "straight",
    style: { stroke: colors.stroke },
    labelStyle: {
      fill: colors.label,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.8,
    },
    labelBgStyle: {
      fill: colors.labelBg,
      fillOpacity: 0.95,
      stroke: colors.stroke,
      strokeWidth: 1,
    },
    labelBgPadding: [6, 4],
    labelBgBorderRadius: 4,
    sourceHandle:
      operator === "AND"
        ? CONDITION_HANDLE_IDS.sourceRight
        : CONDITION_HANDLE_IDS.sourceBottom,
    targetHandle:
      operator === "AND"
        ? CONDITION_HANDLE_IDS.targetLeft
        : CONDITION_HANDLE_IDS.targetTop,
  });
}

function placeLeaf(
  condition: Condition,
  nodeId: string,
  globalX: number,
  globalY: number,
  parentId: string | undefined,
  leafKind: ExpressionLeafKind,
  atomAnnotations?: ConditionGraphAtomAnnotations,
): ConditionGraphResult {
  const size = measureLeafCondition(condition);
  const data = createLeafNodeData(condition, leafKind);
  const dimTrueLeafResolver = atomAnnotations?.dimTrueLeafResolver;
  if (
    leafKind === "condition" &&
    dimTrueLeafResolver &&
    getProvableTruthiness(condition, dimTrueLeafResolver) === "true"
  ) {
    (data as ConditionNodeData).resolvedAsTrue = true;
  }

  const node = createGraphNode(
    nodeId,
    data,
    { x: globalX, y: globalY },
    {
      style: { width: size.width },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
    },
  );

  return withDecodeFalseIfProvedSubtree(
    {
      nodes: [node],
      edges: [],
      size,
      rowsUsed: 1,
      entryNodeId: nodeId,
      entryCenterY: size.height / 2,
    },
    condition,
    atomAnnotations,
  );
}

function createLeafNodeData(
  condition: Condition,
  leafKind: ExpressionLeafKind,
): ConditionNodeData | ValueExpressionNodeData {
  const expressionKind = conditionExpressionKind(condition);

  if (leafKind === "condition") {
    return {
      label: conditionLabel(condition),
      kind: "condition",
      expressionKind,
    };
  }

  return {
    label: conditionLabel(condition),
    kind: "valueExpression",
    expressionKind,
  };
}

function placeGroupContainer(
  condition: Condition & { kind: "paren" },
  nodeId: string,
  globalX: number,
  globalY: number,
  depth: number,
  parentId: string | undefined,
  wrapAndInContainer: boolean,
  elideOrGroup: boolean,
  leafKind: ExpressionLeafKind,
  atomAnnotations?: ConditionGraphAtomAnnotations,
): ConditionGraphResult {
  if (
    shouldElideGroupContainer(
      condition,
      wrapAndInContainer,
      elideOrGroup,
    )
  ) {
    return placeCondition(
      condition.expr,
      nodeId,
      globalX,
      globalY,
      depth,
      parentId,
      wrapAndInContainer,
      elideOrGroup,
      leafKind,
      atomAnnotations,
    );
  }

  const containerMeasure = measureCondition(
    condition,
    false,
    false,
  );

  const containerData: ContainerNodeData = {
    label: "",
    kind: "container",
    depth,
    operator: "group",
  };

  const containerNode = createGraphNode(
    nodeId,
    containerData,
    { x: globalX, y: globalY },
    {
      style: { width: containerMeasure.width, height: containerMeasure.height },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
    },
  );

  const innerResult = placeCondition(
    condition.expr,
    `${nodeId}__inner`,
    CONTAINER_PADDING,
    CONTAINER_PADDING,
    depth + 1,
    nodeId,
    false,
    false,
    leafKind,
    atomAnnotations,
  );

  return withDecodeFalseIfProvedSubtree(
    {
      nodes: [containerNode, ...innerResult.nodes],
      edges: innerResult.edges,
      size: { width: containerMeasure.width, height: containerMeasure.height },
      rowsUsed: Math.max(1, Math.ceil(containerMeasure.height / ROW_HEIGHT)),
      entryNodeId: nodeId,
      entryCenterY: containerMeasure.height / 2,
    },
    condition,
    atomAnnotations,
  );
}

function placeOrChain(
  condition: Condition,
  nodeId: string,
  globalX: number,
  globalY: number,
  depth: number,
  parentId: string | undefined,
  operator: "OR" | "XOR",
  leafKind: ExpressionLeafKind,
  atomAnnotations?: ConditionGraphAtomAnnotations,
): ConditionGraphResult {
  const operands = flattenBooleanChain(condition);
  const childMeasures = operands.map((operand) =>
    measureCondition(operand, true),
  );
  const totalMeasure = measureCondition(condition);

  const nodes: GraphFlowNode[] = [];
  const edges: Edge[] = [];
  const edgeOperatorId = operator.toLowerCase();

  let childY = 0;
  let entryNodeId = "";
  let entryCenterY = 0;
  for (let i = 0; i < operands.length; i++) {
    const childId = `${nodeId}__${String(i)}`;
    const childX = globalX + (totalMeasure.width - childMeasures[i].width) / 2;
    const childResult = placeCondition(
      operands[i],
      childId,
      childX,
      globalY + childY,
      depth,
      parentId,
      true,
      false,
      leafKind,
      atomAnnotations,
    );

    nodes.push(...childResult.nodes);
    edges.push(...childResult.edges);

    if (i === 0) {
      entryNodeId = childResult.entryNodeId;
      entryCenterY = childY + childResult.entryCenterY;
    }

    if (i > 0) {
      const prevChildId = `${nodeId}__${String(i - 1)}`;
      edges.push(
        createBooleanEdge(
          `edge__${nodeId}__${edgeOperatorId}__${String(i)}`,
          prevChildId,
          childId,
          operator,
        ),
      );
    }

    childY += childMeasures[i].height + OR_GAP;
  }

  return withDecodeFalseIfProvedSubtree(
    {
      nodes,
      edges,
      size: { width: totalMeasure.width, height: totalMeasure.height },
      rowsUsed: Math.max(1, Math.ceil(totalMeasure.height / ROW_HEIGHT)),
      entryNodeId,
      entryCenterY,
    },
    condition,
    atomAnnotations,
  );
}

function placeAndChain(
  condition: Condition,
  nodeId: string,
  globalX: number,
  globalY: number,
  depth: number,
  parentId: string | undefined,
  wrapInContainer: boolean,
  leafKind: ExpressionLeafKind,
  atomAnnotations?: ConditionGraphAtomAnnotations,
): ConditionGraphResult {
  const operands = flattenBooleanChain(condition);
  const childMeasures = operands.map((operand) =>
    measureCondition(operand),
  );
  const totalMeasure = measureCondition(
    condition,
    wrapInContainer,
    false,
  );

  if (!wrapInContainer) {
    const nodes: GraphFlowNode[] = [];
    const edges: Edge[] = [];
    const maxChildHeight = Math.max(...childMeasures.map((m) => m.height));

    let childX = 0;
    let entryNodeId = "";
    let entryCenterY = 0;
    for (let i = 0; i < operands.length; i++) {
      const childId = `${nodeId}__${String(i)}`;
      const childY = (maxChildHeight - childMeasures[i].height) / 2;
      const childResult = placeCondition(
        operands[i],
        childId,
        globalX + childX,
        globalY + childY,
        depth,
        parentId,
        false,
        false,
        leafKind,
        atomAnnotations,
      );

      nodes.push(...childResult.nodes);
      edges.push(...childResult.edges);

      if (i === 0) {
        entryNodeId = childResult.entryNodeId;
        entryCenterY = childY + childResult.entryCenterY;
      }

      if (i > 0) {
        const prevChildId = `${nodeId}__${String(i - 1)}`;
        edges.push(
          createBooleanEdge(
            `edge__${nodeId}__and__${String(i)}`,
            prevChildId,
            childId,
            "AND",
          ),
        );
      }

      childX += childMeasures[i].width + AND_GAP;
    }

    return withDecodeFalseIfProvedSubtree(
      {
        nodes,
        edges,
        size: { width: totalMeasure.width, height: totalMeasure.height },
        rowsUsed: Math.max(1, Math.ceil(totalMeasure.height / ROW_HEIGHT)),
        entryNodeId,
        entryCenterY,
      },
      condition,
      atomAnnotations,
    );
  }

  const containerData: ContainerNodeData = {
    label: "AND",
    kind: "container",
    depth,
    operator: "and",
  };

  const containerNode = createGraphNode(
    nodeId,
    containerData,
    { x: globalX, y: globalY },
    {
      style: { width: totalMeasure.width, height: totalMeasure.height },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
    },
  );

  const nodes: GraphFlowNode[] = [containerNode];
  const edges: Edge[] = [];
  const maxChildHeight = Math.max(...childMeasures.map((m) => m.height));

  let childX = CONTAINER_PADDING;
  for (let i = 0; i < operands.length; i++) {
    const childId = `${nodeId}__${String(i)}`;
    const childY =
      CONTAINER_PADDING + (maxChildHeight - childMeasures[i].height) / 2;
    const childResult = placeCondition(
      operands[i],
      childId,
      childX,
      childY,
      depth + 1,
      nodeId,
      false,
      false,
      leafKind,
      atomAnnotations,
    );

    nodes.push(...childResult.nodes);
    edges.push(...childResult.edges);

    if (i > 0) {
      const prevChildId = `${nodeId}__${String(i - 1)}`;
      edges.push(
        createBooleanEdge(
          `edge__${nodeId}__and__${String(i)}`,
          prevChildId,
          childId,
          "AND",
        ),
      );
    }

    childX += childMeasures[i].width + AND_GAP;
  }

  return withDecodeFalseIfProvedSubtree(
    {
      nodes,
      edges,
      size: { width: totalMeasure.width, height: totalMeasure.height },
      rowsUsed: Math.max(1, Math.ceil(totalMeasure.height / ROW_HEIGHT)),
      entryNodeId: nodeId,
      entryCenterY: totalMeasure.height / 2,
    },
    condition,
    atomAnnotations,
  );
}

function placeCondition(
  condition: Condition,
  nodeId: string,
  globalX: number,
  globalY: number,
  depth: number,
  parentId: string | undefined,
  wrapAndInContainer = false,
  elideOrGroup = false,
  leafKind: ExpressionLeafKind = "condition",
  atomAnnotations?: ConditionGraphAtomAnnotations,
): ConditionGraphResult {
  if (condition.kind === "paren") {
    return placeGroupContainer(
      condition,
      nodeId,
      globalX,
      globalY,
      depth,
      parentId,
      wrapAndInContainer,
      elideOrGroup,
      leafKind,
      atomAnnotations,
    );
  }

  if (condition.kind === "binary" && BOOLEAN_CHAIN_OPS.has(condition.op)) {
    if (condition.op === "&") {
      return placeAndChain(
        condition,
        nodeId,
        globalX,
        globalY,
        depth,
        parentId,
        wrapAndInContainer,
        leafKind,
        atomAnnotations,
      );
    }
    return placeOrChain(
      condition,
      nodeId,
      globalX,
      globalY,
      depth,
      parentId,
      condition.op === "^" ? "XOR" : "OR",
      leafKind,
      atomAnnotations,
    );
  }

  return placeLeaf(
    condition,
    nodeId,
    globalX,
    globalY,
    parentId,
    leafKind,
    atomAnnotations,
  );
}

export function placeConditionGraph(
  condition: Condition,
  nodeId: string,
  globalX: number,
  globalY: number,
  depth = 0,
  atomAnnotations?: ConditionGraphAtomAnnotations,
): ConditionGraphResult {
  return placeCondition(
    condition,
    nodeId,
    globalX,
    globalY,
    depth,
    undefined,
    false,
    true,
    "condition",
    atomAnnotations,
  );
}

export function placeValueExpressionGraph(
  condition: Condition,
  nodeId: string,
  globalX: number,
  globalY: number,
  depth = 0,
): ConditionGraphResult {
  return placeCondition(
    condition,
    nodeId,
    globalX,
    globalY,
    depth,
    undefined,
    false,
    true,
    "valueExpression",
  );
}
