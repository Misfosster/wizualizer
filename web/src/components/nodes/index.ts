import type { NodeTypes } from "@xyflow/react";
import "./nodes.css";
import ActionNode from "./ActionNode";
import BlockNode from "./BlockNode";
import CallActionListNode from "./CallActionListNode";
import ConditionNode from "./ConditionNode";
import ContainerNode from "./ContainerNode";
import RootNode from "./RootNode";
import SequenceNode from "./SequenceNode";
import TargetRankingNode from "./TargetRankingNode";
import UseItemNode from "./UseItemNode";
import ValueExpressionNode from "./ValueExpressionNode";
import VariableNode from "./VariableNode";

export const nodeTypes = {
  root: RootNode,
  block: BlockNode,
  action: ActionNode,
  variable: VariableNode,
  useItem: UseItemNode,
  callActionList: CallActionListNode,
  sequence: SequenceNode,
  condition: ConditionNode,
  targetRanking: TargetRankingNode,
  valueExpression: ValueExpressionNode,
  container: ContainerNode,
} satisfies NodeTypes;
