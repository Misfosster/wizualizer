import { prettyCond } from "./pretty-log";
import type { Condition, IdentRef, Segment } from "./types";

const DEFAULT_VARIABLE_OP = "set";
const UNNAMED_VARIABLE = "(unnamed)";
const MISSING_VALUE = "(no value)";
const UNNAMED_ITEM = "(unnamed item)";
const UNNAMED_ACTION_LIST = "(unnamed list)";

export interface ConditionSegment {
  type: "if" | "target_if";
  expr: Condition;
}

interface SequenceSegment {
  type: "sequence";
  expr: Condition;
}

export interface ExtractedVariableData {
  variableName: string;
  op: string;
  valueText: string;
}

export function getConditionSegments(segments: Segment[]): ConditionSegment[] {
  return segments.filter(
    (segment): segment is ConditionSegment =>
      segment.type === "if" || segment.type === "target_if",
  );
}

export const BOOLEAN_CHAIN_OPS: ReadonlySet<string> = new Set(["|", "&", "^"]);

export function flattenBooleanChain(expr: Condition): Condition[] {
  if (expr.kind !== "binary" || !BOOLEAN_CHAIN_OPS.has(expr.op)) {
    return [expr];
  }
  return collectChainOperands(expr, expr.op);
}

function collectChainOperands(expr: Condition, op: string): Condition[] {
  if (expr.kind === "binary" && expr.op === op) {
    return [
      ...collectChainOperands(expr.left, op),
      ...collectChainOperands(expr.right, op),
    ];
  }
  return [expr];
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

export function extractVariableData(segments: Segment[]): ExtractedVariableData {
  const nameSegment = findOtherSegment(segments, "name");
  const opSegment = findOtherSegment(segments, "op");
  const valueSegment = findOtherSegment(segments, "value");

  return {
    variableName: nameSegment ? prettyCond(nameSegment.expr) : UNNAMED_VARIABLE,
    op: opSegment ? prettyCond(opSegment.expr) : DEFAULT_VARIABLE_OP,
    valueText: valueSegment ? prettyCond(valueSegment.expr) : MISSING_VALUE,
  };
}

export function extractCallTarget(segments: Segment[]): string {
  const targetSegment = findOtherSegment(segments, "name");
  return targetSegment ? prettyCond(targetSegment.expr) : UNNAMED_ACTION_LIST;
}

export function extractUseItemName(segments: Segment[]): string {
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

export function extractSequenceSpells(segments: Segment[]): string[] {
  const sequenceSegment = segments.find(
    (segment): segment is SequenceSegment => segment.type === "sequence",
  );

  if (sequenceSegment?.expr.kind !== "sequence") {
    return [];
  }

  return sequenceSegment.expr.expr.map((ident: IdentRef) => ident.name);
}
