import type {
  AritOp,
  BinExpr,
  BoolOp,
  CallExpr,
  Condition,
  IdentRef,
  UnaryExpr,
} from "@/utils/apl-parser/types";
import { resolveAtom } from "@/utils/conditions/resolve-atom";
import type { ProfileResolutionContext } from "@/utils/conditions/resolve-atom";
import {
  EMPTY_ATOM_OVERRIDES,
} from "@/utils/conditions/types";
import {
  UNKNOWN_VALUE,
  boolValue,
  numberValue,
  type EvalValue,
} from "./types";

/**
 * Reduce a SimC condition AST to an `EvalValue` by delegating leaf
 * resolution to a pluggable `AtomResolver`. The resolver is the only
 * piece that needs to know about talents, overrides, profiles, etc.;
 * the rest of the evaluator is pure three-valued boolean / arithmetic.
 *
 * Two entry points:
 *
 *   - `evaluateCondition(condition, selections)` is the original API:
 *     resolves only `talent.*` atoms via the rank map and treats every
 *     other identifier as `unknown`. Kept as a thin wrapper so existing
 *     call sites and tests stay untouched.
 *   - `evaluateConditionWith(condition, resolveAtom)` is the new API
 *     used by the override-aware pipeline; pass any function that
 *     turns an `IdentRef` into an `EvalValue`.
 *
 * Never throws. Unsupported operators or shapes return `unknown` so the
 * caller can stay conservative ("impossible only when definitely false").
 */
export type AtomResolver = (ident: IdentRef) => EvalValue;

export function evaluateConditionWith(
  condition: Condition,
  resolveAtomFn: AtomResolver,
): EvalValue {
  switch (condition.kind) {
    case "ident":
      return resolveAtomFn(condition);
    case "number":
      return numberValue(condition.value);
    case "paren":
      return evaluateConditionWith(condition.expr, resolveAtomFn);
    case "call":
      return evaluateCall(condition, resolveAtomFn);
    case "unary":
      return evaluateUnary(condition, resolveAtomFn);
    case "binary":
      return evaluateBinary(condition, resolveAtomFn);
    case "sequence":
      return UNKNOWN_VALUE;
  }
}

export function evaluateCondition(
  condition: Condition,
  selections: Readonly<Record<string, number>>,
): EvalValue {
  return evaluateConditionWith(
    condition,
    makeTalentOnlyResolver(selections),
  );
}

/**
 * Talent-only resolver - the legacy lookup encoded as an `AtomResolver`.
 * Exposed so tests and callers that only have a selection map can use
 * the new evaluator surface without rebuilding context plumbing.
 */
export function makeTalentOnlyResolver(
  selections: Readonly<Record<string, number>>,
): AtomResolver {
  const context: ProfileResolutionContext = {
    selections,
    globalOverrides: EMPTY_ATOM_OVERRIDES,
    profileOverrides: EMPTY_ATOM_OVERRIDES,
  };
  return (ident) => resolveAtom(ident, context);
}

function evaluateCall(call: CallExpr, resolve: AtomResolver): EvalValue {
  if (call.args.length !== 1) {
    return UNKNOWN_VALUE;
  }

  const arg = evaluateConditionWith(call.args[0], resolve);
  const num = asNumber(arg);
  if (num === null) {
    return UNKNOWN_VALUE;
  }

  switch (call.name) {
    case "floor":
      return numberValue(Math.floor(num));
    case "ceil":
      return numberValue(Math.ceil(num));
  }
}

function evaluateUnary(unary: UnaryExpr, resolve: AtomResolver): EvalValue {
  const operand = evaluateConditionWith(unary.expr, resolve);
  switch (unary.op) {
    case "!": {
      const truthy = asTruthy(operand);
      return truthy === null ? UNKNOWN_VALUE : boolValue(!truthy);
    }
    case "@": {
      const num = asNumber(operand);
      return num === null ? UNKNOWN_VALUE : numberValue(Math.abs(num));
    }
    case "+": {
      const num = asNumber(operand);
      return num === null ? UNKNOWN_VALUE : numberValue(num);
    }
    case "-": {
      const num = asNumber(operand);
      return num === null ? UNKNOWN_VALUE : numberValue(-num);
    }
  }
}

function evaluateBinary(binary: BinExpr, resolve: AtomResolver): EvalValue {
  const op = binary.op;
  switch (op) {
    case "&":
      return evaluateAnd(binary, resolve);
    case "|":
      return evaluateOr(binary, resolve);
    case "^":
      return evaluateXor(binary, resolve);
    case "~":
    case "!~":
      return UNKNOWN_VALUE;
    case "=":
    case "==":
    case "!=":
    case "<":
    case "<=":
    case ">":
    case ">=":
      return evaluateComparison(op, binary, resolve);
    case "<?":
    case ">?":
      return evaluateMinMax(op, binary, resolve);
    default:
      return evaluateArithmetic(op, binary, resolve);
  }
}

function evaluateAnd(binary: BinExpr, resolve: AtomResolver): EvalValue {
  const left = asTruthy(evaluateConditionWith(binary.left, resolve));
  if (left === false) {
    return boolValue(false);
  }

  const right = asTruthy(evaluateConditionWith(binary.right, resolve));
  if (right === false) {
    return boolValue(false);
  }

  if (left === null || right === null) {
    return UNKNOWN_VALUE;
  }

  return boolValue(true);
}

function evaluateOr(binary: BinExpr, resolve: AtomResolver): EvalValue {
  const left = asTruthy(evaluateConditionWith(binary.left, resolve));
  if (left === true) {
    return boolValue(true);
  }

  const right = asTruthy(evaluateConditionWith(binary.right, resolve));
  if (right === true) {
    return boolValue(true);
  }

  if (left === null || right === null) {
    return UNKNOWN_VALUE;
  }

  return boolValue(false);
}

function evaluateXor(binary: BinExpr, resolve: AtomResolver): EvalValue {
  const left = asTruthy(evaluateConditionWith(binary.left, resolve));
  const right = asTruthy(evaluateConditionWith(binary.right, resolve));
  if (left === null || right === null) {
    return UNKNOWN_VALUE;
  }

  return boolValue(left !== right);
}

function evaluateComparison(
  op: BoolOp,
  binary: BinExpr,
  resolve: AtomResolver,
): EvalValue {
  const left = asNumber(evaluateConditionWith(binary.left, resolve));
  const right = asNumber(evaluateConditionWith(binary.right, resolve));
  if (left === null || right === null) {
    return UNKNOWN_VALUE;
  }

  switch (op) {
    case "=":
    case "==":
      return boolValue(left === right);
    case "!=":
      return boolValue(left !== right);
    case "<":
      return boolValue(left < right);
    case "<=":
      return boolValue(left <= right);
    case ">":
      return boolValue(left > right);
    case ">=":
      return boolValue(left >= right);
    default:
      return UNKNOWN_VALUE;
  }
}

function evaluateMinMax(
  op: "<?" | ">?",
  binary: BinExpr,
  resolve: AtomResolver,
): EvalValue {
  const left = asNumber(evaluateConditionWith(binary.left, resolve));
  const right = asNumber(evaluateConditionWith(binary.right, resolve));
  if (left === null || right === null) {
    return UNKNOWN_VALUE;
  }

  return numberValue(op === "<?" ? Math.min(left, right) : Math.max(left, right));
}

function evaluateArithmetic(
  op: AritOp,
  binary: BinExpr,
  resolve: AtomResolver,
): EvalValue {
  const left = asNumber(evaluateConditionWith(binary.left, resolve));
  const right = asNumber(evaluateConditionWith(binary.right, resolve));
  if (left === null || right === null) {
    return UNKNOWN_VALUE;
  }

  switch (op) {
    case "+":
      return numberValue(left + right);
    case "-":
      return numberValue(left - right);
    case "*":
      return numberValue(left * right);
    case "/":
    case "%":
      return right === 0 ? UNKNOWN_VALUE : numberValue(left / right);
    case "%%":
      return right === 0 ? UNKNOWN_VALUE : numberValue(left % right);
  }
}

function asTruthy(value: EvalValue): boolean | null {
  if (value.kind === "bool") {
    return value.value;
  }

  if (value.kind === "number") {
    return value.value !== 0;
  }

  return null;
}

function asNumber(value: EvalValue): number | null {
  if (value.kind === "number") {
    return value.value;
  }

  if (value.kind === "bool") {
    return value.value ? 1 : 0;
  }

  return null;
}
