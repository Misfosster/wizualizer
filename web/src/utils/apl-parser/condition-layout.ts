import { Position as FlowPosition, type Edge, type Node } from "@xyflow/react";
import { prettyCond } from "./pretty-log";
import type { Condition } from "./types";
import { BOOLEAN_CHAIN_OPS, flattenBooleanChain } from "./action-data";
import { ROW_HEIGHT } from "./grid-layout";
import type {
  ConditionNodeData,
  ContainerNodeData,
  GraphFlowNode,
  GraphNodeData,
} from "@/components/nodes/types";
import { CONDITION_HANDLE_IDS } from "@/components/nodes/types";
import type { Size } from "./grid-layout";

const CONDITION_MIN_WIDTH = 220;
const CONDITION_CELL: Readonly<Size> = {
  width: CONDITION_MIN_WIDTH,
  height: 64,
};
const CONDITION_TEXT_PADDING = 64;
const CONDITION_CHAR_WIDTH = 7.8;
const AND_GAP = 96;
const OR_GAP = 48;
const CONTAINER_PADDING = 20;

const DEFAULT_EDGE_STYLE = { stroke: "#6b7280" } as const;
const BOOLEAN_EDGE_COLORS: Record<
  BooleanEdgeOperator,
  { stroke: string; label: string; labelBg: string }
> = {
  AND: { stroke: "#0f766e", label: "#115e59", labelBg: "#ccfbf1" },
  OR: { stroke: "#2563eb", label: "#1d4ed8", labelBg: "#dbeafe" },
  XOR: { stroke: "#7c3aed", label: "#6d28d9", labelBg: "#ede9fe" },
};

type BooleanEdgeOperator = "AND" | "OR" | "XOR";

interface ConditionMeasure {
  width: number;
  height: number;
}

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

export interface ConditionGraphResult {
  nodes: GraphFlowNode[];
  edges: Edge[];
  size: Size;
  rowsUsed: number;
}

function measureCondition(
  condition: Condition,
  wrapAndInContainer = false,
  elideOrGroup = false,
): ConditionMeasure {
  if (condition.kind === "paren") {
    if (shouldElideGroupContainer(condition, wrapAndInContainer, elideOrGroup)) {
      return measureCondition(condition.expr, wrapAndInContainer, elideOrGroup);
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
      const childMeasures = operands.map((operand) => measureCondition(operand));
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
  const label = prettyCond(condition);
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
  if (condition.expr.kind !== "binary") {
    return true;
  }

  if (condition.expr.op === "&" && wrapAndInContainer) {
    return true;
  }

  return (
    elideOrGroup &&
    (condition.expr.op === "|" || condition.expr.op === "^")
  );
}

function createGraphNode(
  id: string,
  data: GraphNodeData,
  position: { x: number; y: number },
  extra?: Partial<Node>,
): GraphFlowNode {
  return {
    id,
    type: data.kind,
    position,
    data,
    sourcePosition: FlowPosition.Right,
    targetPosition: FlowPosition.Left,
    ...extra,
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
): ConditionGraphResult {
  const size = measureLeafCondition(condition);
  const data: ConditionNodeData = {
    label: prettyCond(condition),
    kind: "condition",
  };

  const node = createGraphNode(
    nodeId,
    data,
    { x: globalX, y: globalY },
    {
      style: { width: size.width },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
    },
  );

  return {
    nodes: [node],
    edges: [],
    size,
    rowsUsed: 1,
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
): ConditionGraphResult {
  if (shouldElideGroupContainer(condition, wrapAndInContainer, elideOrGroup)) {
    return placeCondition(
      condition.expr,
      nodeId,
      globalX,
      globalY,
      depth,
      parentId,
      wrapAndInContainer,
      elideOrGroup,
    );
  }

  const containerMeasure = measureCondition(condition);

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
  );

  return {
    nodes: [containerNode, ...innerResult.nodes],
    edges: innerResult.edges,
    size: { width: containerMeasure.width, height: containerMeasure.height },
    rowsUsed: Math.max(1, Math.ceil(containerMeasure.height / ROW_HEIGHT)),
  };
}

function placeOrChain(
  condition: Condition,
  nodeId: string,
  globalX: number,
  globalY: number,
  depth: number,
  parentId: string | undefined,
  operator: "OR" | "XOR",
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
    );

    nodes.push(...childResult.nodes);
    edges.push(...childResult.edges);

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

  return {
    nodes,
    edges,
    size: { width: totalMeasure.width, height: totalMeasure.height },
    rowsUsed: Math.max(1, Math.ceil(totalMeasure.height / ROW_HEIGHT)),
  };
}

function placeAndChain(
  condition: Condition,
  nodeId: string,
  globalX: number,
  globalY: number,
  depth: number,
  parentId: string | undefined,
  wrapInContainer: boolean,
): ConditionGraphResult {
  const operands = flattenBooleanChain(condition);
  const childMeasures = operands.map((operand) => measureCondition(operand));
  const totalMeasure = measureCondition(condition, wrapInContainer);

  if (!wrapInContainer) {
    const nodes: GraphFlowNode[] = [];
    const edges: Edge[] = [];
    const maxChildHeight = Math.max(...childMeasures.map((m) => m.height));

    let childX = 0;
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

    return {
      nodes,
      edges,
      size: { width: totalMeasure.width, height: totalMeasure.height },
      rowsUsed: Math.max(1, Math.ceil(totalMeasure.height / ROW_HEIGHT)),
    };
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

  return {
    nodes,
    edges,
    size: { width: totalMeasure.width, height: totalMeasure.height },
    rowsUsed: Math.max(1, Math.ceil(totalMeasure.height / ROW_HEIGHT)),
  };
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
    );
  }

  return placeLeaf(condition, nodeId, globalX, globalY, parentId);
}

export function placeConditionGraph(
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
  );
}
