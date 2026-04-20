import { flattenBooleanChain } from "@/utils/apl-parser/action-data";
import type { BinExpr, Condition, IdentRef } from "@/utils/apl-parser/types";
import { evaluateConditionWith, type AtomResolver } from "./evaluate-condition";

type Truthiness = "true" | "false" | "unknown";

interface SimplifiedCondition {
  truthiness: Truthiness;
  expr: Condition | null;
}

/**
 * Simplify a condition for rendering while preserving filtering semantics.
 *
 * Rules:
 * - In `A | B`, remove any child proven false (`false | X => X`).
 * - In `A & B`, remove any child proven true (`true & X => X`).
 * - If an entire segment is proven true, return `null` (nothing to render).
 * - If an entire segment is proven false, keep the original expression so
 *   impossible actions still show a meaningful failing condition.
 */
export function simplifyConditionForRender(
  condition: Condition,
  resolveAtom: AtomResolver,
): Condition | null {
  const simplified = simplify(condition, resolveAtom);
  if (simplified.truthiness === "true") {
    return null;
  }
  if (simplified.truthiness === "false") {
    return condition;
  }
  return simplified.expr ?? condition;
}

function simplify(condition: Condition, resolveAtom: AtomResolver): SimplifiedCondition {
  if (condition.kind === "binary" && condition.op === "|") {
    return simplifyOr(condition, resolveAtom);
  }
  if (condition.kind === "binary" && condition.op === "&") {
    return simplifyAnd(condition, resolveAtom);
  }
  if (condition.kind === "unary" && condition.op === "!") {
    const inner = simplify(condition.expr, resolveAtom);
    if (inner.truthiness === "true") {
      return { truthiness: "false", expr: null };
    }
    if (inner.truthiness === "false") {
      return { truthiness: "true", expr: null };
    }
    if (!inner.expr) {
      return { truthiness: "unknown", expr: condition };
    }
    return {
      truthiness: "unknown",
      expr: { ...condition, expr: inner.expr },
    };
  }
  if (condition.kind === "paren") {
    const inner = simplify(condition.expr, resolveAtom);
    if (inner.truthiness !== "unknown") {
      return { truthiness: inner.truthiness, expr: null };
    }
    if (!inner.expr) {
      return { truthiness: "unknown", expr: condition };
    }
    return {
      truthiness: "unknown",
      expr: { ...condition, expr: inner.expr },
    };
  }

  const truthiness = evaluateTruthiness(condition, resolveAtom);
  return {
    truthiness,
    expr: truthiness === "unknown" ? condition : null,
  };
}

function simplifyOr(condition: BinExpr, resolveAtom: AtomResolver): SimplifiedCondition {
  const operands = flattenBooleanChain(condition);
  const unknownOperands: Condition[] = [];
  for (const operand of operands) {
    const simplified = simplify(operand, resolveAtom);
    if (simplified.truthiness === "true") {
      return { truthiness: "true", expr: null };
    }
    if (simplified.truthiness === "unknown" && simplified.expr) {
      unknownOperands.push(simplified.expr);
    }
  }

  if (unknownOperands.length === 0) {
    return { truthiness: "false", expr: null };
  }
  if (unknownOperands.length === 1) {
    return { truthiness: "unknown", expr: unknownOperands[0] };
  }
  return {
    truthiness: "unknown",
    expr: rebuildBooleanChain("|", unknownOperands),
  };
}

function simplifyAnd(condition: BinExpr, resolveAtom: AtomResolver): SimplifiedCondition {
  const operands = flattenBooleanChain(condition);
  const unknownOperands: Condition[] = [];
  for (const operand of operands) {
    const simplified = simplify(operand, resolveAtom);
    if (simplified.truthiness === "false") {
      return { truthiness: "false", expr: null };
    }
    if (simplified.truthiness === "unknown" && simplified.expr) {
      unknownOperands.push(simplified.expr);
    }
  }

  if (unknownOperands.length === 0) {
    return { truthiness: "true", expr: null };
  }
  if (unknownOperands.length === 1) {
    return { truthiness: "unknown", expr: unknownOperands[0] };
  }
  return {
    truthiness: "unknown",
    expr: rebuildBooleanChain("&", unknownOperands),
  };
}

function evaluateTruthiness(condition: Condition, resolveAtom: AtomResolver): Truthiness {
  const result = evaluateConditionWith(condition, (ident: IdentRef) => resolveAtom(ident));
  if (result.kind === "unknown") {
    return "unknown";
  }
  if (result.kind === "bool") {
    return result.value ? "true" : "false";
  }
  return result.value !== 0 ? "true" : "false";
}

function rebuildBooleanChain(op: "|" | "&", operands: readonly Condition[]): Condition {
  let acc = operands[0];
  for (let i = 1; i < operands.length; i++) {
    acc = {
      kind: "binary",
      op,
      left: acc,
      right: operands[i],
    };
  }
  return acc;
}
