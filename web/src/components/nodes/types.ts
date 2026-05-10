import type { Node } from "@xyflow/react";
import type { TalentState } from "@/utils/talents/types";

export const CONDITION_HANDLE_IDS = {
  targetLeft: "condition-target-left",
  sourceRight: "condition-source-right",
  targetTop: "condition-target-top",
  sourceBottom: "condition-source-bottom",
} as const;

// Re-export so node consumers do not need to know about the talents module.
export type { TalentState } from "@/utils/talents/types";

export type GraphNodeKind =
  | "root"
  | "block"
  | "action"
  | "variable"
  | "useItem"
  | "callActionList"
  | "sequence"
  | "condition"
  | "targetRanking"
  | "valueExpression"
  | "container";

export interface RootNodeData extends Record<string, unknown> {
  label: string;
  kind: "root";
  blockCount: number;
  actionCount: number;
}

export interface BlockNodeData extends Record<string, unknown> {
  label: string;
  kind: "block";
  actionCount: number;
  isCollapsed: boolean;
}

export interface ActionNodeData extends Record<string, unknown> {
  label: string;
  kind: "action";
  hasCondition: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  talentState?: TalentState;
  talentReason?: string;
  actionListName: string;
  sourceLineNumber: number;
}

export interface VariableNodeData extends Record<string, unknown> {
  label: string;
  kind: "variable";
  variableName: string;
  op: string;
  hasExplicitOp: boolean;
  hasCondition: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  valueText: string;
  talentState?: TalentState;
  talentReason?: string;
  actionListName: string;
  sourceLineNumber: number;
}

export interface UseItemNodeData extends Record<string, unknown> {
  label: string;
  kind: "useItem";
  itemName: string;
  hasCondition: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  talentState?: TalentState;
  talentReason?: string;
  actionListName: string;
  sourceLineNumber: number;
}

export interface CallActionListNodeData extends Record<string, unknown> {
  label: string;
  kind: "callActionList";
  targetList: string;
  targetBlockId: string | null;
  hasCondition: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  talentState?: TalentState;
  talentReason?: string;
  actionListName: string;
  sourceLineNumber: number;
}

export interface SequenceNodeData extends Record<string, unknown> {
  label: string;
  kind: "sequence";
  spells: string[];
  hasCondition: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  talentState?: TalentState;
  talentReason?: string;
  actionListName: string;
  sourceLineNumber: number;
}

export interface ConditionHandleUsage extends Record<string, boolean | undefined> {
  targetLeft?: boolean;
  sourceRight?: boolean;
  targetTop?: boolean;
  sourceBottom?: boolean;
}

export type ConditionExpressionKind =
  | "comparison"
  | "arithmetic"
  | "expression";
export type ConditionSegmentKind = "if" | "target_if";

export interface ConditionNodeData extends Record<string, unknown> {
  label: string;
  kind: "condition";
  segmentKind?: ConditionSegmentKind;
  expressionKind?: ConditionExpressionKind;
  handleUsage?: ConditionHandleUsage;
  /** Provably true under talents + overrides when the condition-filter toggle is on (ring + badge, not faded). */
  resolvedAsTrue?: boolean;
  /**
   * Single leaf provably false under the same resolver as resolved-true (condition
   * filter), when talent-branch decode is not the one marking this node.
   */
  resolvedAsFalse?: boolean;
  /**
   * Provably false under decode/overrides while talent Dim mode is on; action
   * may still exist (e.g. sibling OR arm still viable).
   */
  decodeProvedFalse?: boolean;
  talentState?: TalentState;
  talentReason?: string;
}

export interface TargetRankingNodeData extends Record<string, unknown> {
  label: string;
  kind: "targetRanking";
  mode: "min" | "max";
  talentState?: TalentState;
  talentReason?: string;
}

export interface ValueExpressionNodeData extends Record<string, unknown> {
  label: string;
  kind: "valueExpression";
  expressionKind?: ConditionExpressionKind;
  handleUsage?: ConditionHandleUsage;
  decodeProvedFalse?: boolean;
  talentState?: TalentState;
  talentReason?: string;
}

export interface ContainerNodeData extends Record<string, unknown> {
  label: string;
  kind: "container";
  depth: number;
  operator: string;
  handleUsage?: ConditionHandleUsage;
  decodeProvedFalse?: boolean;
  talentState?: TalentState;
  talentReason?: string;
}

export type GraphNodeData =
  | RootNodeData
  | BlockNodeData
  | ActionNodeData
  | VariableNodeData
  | UseItemNodeData
  | CallActionListNodeData
  | SequenceNodeData
  | ConditionNodeData
  | TargetRankingNodeData
  | ValueExpressionNodeData
  | ContainerNodeData;

export type RootFlowNode = Node<RootNodeData, "root">;
export type BlockFlowNode = Node<BlockNodeData, "block">;
export type ActionFlowNode = Node<ActionNodeData, "action">;
export type VariableFlowNode = Node<VariableNodeData, "variable">;
export type UseItemFlowNode = Node<UseItemNodeData, "useItem">;
export type CallActionListFlowNode = Node<
  CallActionListNodeData,
  "callActionList"
>;
export type SequenceFlowNode = Node<SequenceNodeData, "sequence">;
export type ConditionFlowNode = Node<ConditionNodeData, "condition">;
export type TargetRankingFlowNode = Node<
  TargetRankingNodeData,
  "targetRanking"
>;
export type ValueExpressionFlowNode = Node<
  ValueExpressionNodeData,
  "valueExpression"
>;
export type ContainerFlowNode = Node<ContainerNodeData, "container">;

export type GraphFlowNode =
  | RootFlowNode
  | BlockFlowNode
  | ActionFlowNode
  | VariableFlowNode
  | UseItemFlowNode
  | CallActionListFlowNode
  | SequenceFlowNode
  | ConditionFlowNode
  | TargetRankingFlowNode
  | ValueExpressionFlowNode
  | ContainerFlowNode;

export type ActionGraphNodeKind = Extract<
  GraphNodeKind,
  "action" | "variable" | "useItem" | "callActionList" | "sequence"
>;
