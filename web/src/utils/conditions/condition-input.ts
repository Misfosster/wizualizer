import { parseConditionExpression } from "@/utils/apl-parser/parser";
import type { BinExpr, BinOp, Condition } from "@/utils/apl-parser/types";
import {
  canonicalAtomKey,
  isTalentAtomKey,
  parseAtomKey,
} from "./atom-key";
import { inferAtomValueKind } from "./atom-value-kind";
import type { ConditionAtom, ConditionAtomValueKind } from "./types";

const AURA_NAMESPACES = new Set(["buff", "debuff"]);
const AURA_QUANTITY_PROPERTIES = new Set([
  "react",
  "remains",
  "stack",
  "stacks",
]);

export function makeConditionAtomFromKey(
  key: string,
  usage: ConditionAtomValueKind = "boolean",
): ConditionAtom | null {
  const canonicalKey = canonicalAtomKey(key);
  if (canonicalKey.length === 0) {
    return null;
  }
  return {
    key: canonicalKey,
    parts: parseAtomKey(canonicalKey),
    isTalent: isTalentAtomKey(canonicalKey),
    valueKind: inferAtomValueKind(canonicalKey, usage),
  };
}

export function makeConditionAtomFromInput(
  input: string,
): ConditionAtom | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const condition = parseConditionExpression(trimmed);
    return atomFromCondition(condition);
  } catch {
    return makeConditionAtomFromKey(trimmed);
  }
}

function atomFromCondition(condition: Condition): ConditionAtom | null {
  switch (condition.kind) {
    case "ident":
      return makeConditionAtomFromKey(condition.name, "boolean");
    case "paren":
      return atomFromCondition(condition.expr);
    case "unary":
      if (condition.op === "!") {
        return atomFromNegatedCondition(condition.expr);
      }
      return atomFromCondition(condition.expr);
    case "binary":
      return atomFromBinaryCondition(condition);
    case "call":
    case "number":
    case "sequence":
      return null;
  }
}

function atomFromNegatedCondition(condition: Condition): ConditionAtom | null {
  if (condition.kind === "paren") {
    return atomFromNegatedCondition(condition.expr);
  }
  if (condition.kind !== "ident") {
    return null;
  }

  const key = canonicalAtomKey(condition.name);
  const parts = parseAtomKey(key);
  if (parts.property === "up") {
    return makeConditionAtomFromKey(
      [parts.namespace, parts.subject, "down"].filter(Boolean).join("."),
    );
  }
  if (parts.property === "down") {
    return makeConditionAtomFromKey(
      [parts.namespace, parts.subject, "up"].filter(Boolean).join("."),
    );
  }
  return makeConditionAtomFromKey(key);
}

function atomFromBinaryCondition(condition: BinExpr): ConditionAtom | null {
  const alias = aliasFromComparison(condition);
  if (alias) {
    return alias;
  }

  const leftIdent = unwrapIdent(condition.left);
  if (leftIdent) {
    return makeConditionAtomFromKey(leftIdent, "number");
  }
  const rightIdent = unwrapIdent(condition.right);
  if (rightIdent) {
    return makeConditionAtomFromKey(rightIdent, "number");
  }
  return null;
}

function aliasFromComparison(condition: BinExpr): ConditionAtom | null {
  const leftIdent = unwrapIdent(condition.left);
  const rightIdent = unwrapIdent(condition.right);
  const leftNumber = unwrapNumber(condition.left);
  const rightNumber = unwrapNumber(condition.right);

  if (leftIdent && rightNumber !== null) {
    return aliasForIdentComparison(leftIdent, condition.op, rightNumber);
  }
  if (rightIdent && leftNumber !== null) {
    return aliasForIdentComparison(
      rightIdent,
      reverseComparison(condition.op),
      leftNumber,
    );
  }
  return null;
}

function aliasForIdentComparison(
  ident: string,
  op: BinOp,
  number: number,
): ConditionAtom | null {
  const key = canonicalAtomKey(ident);
  const parts = parseAtomKey(key);
  const property = lastSegment(parts.property);

  if (
    AURA_NAMESPACES.has(parts.namespace) &&
    AURA_QUANTITY_PROPERTIES.has(property)
  ) {
    if (isPositiveCheck(op, number)) {
      return makeConditionAtomFromKey(`${parts.namespace}.${parts.subject}.up`);
    }
    if (isZeroCheck(op, number)) {
      return makeConditionAtomFromKey(
        `${parts.namespace}.${parts.subject}.down`,
      );
    }
  }

  if (parts.namespace === "cooldown" && property === "remains") {
    if (isPositiveCheck(op, number)) {
      return makeConditionAtomFromKey(`cooldown.${parts.subject}.down`);
    }
    if (isZeroCheck(op, number)) {
      return makeConditionAtomFromKey(`cooldown.${parts.subject}.up`);
    }
  }

  if (parts.namespace === "dot" && property === "remains") {
    if (isPositiveCheck(op, number)) {
      return makeConditionAtomFromKey(`dot.${parts.subject}.ticking`);
    }
    if (isZeroCheck(op, number)) {
      return makeConditionAtomFromKey(`dot.${parts.subject}.ticking`);
    }
  }

  return null;
}

function unwrapIdent(condition: Condition): string | null {
  if (condition.kind === "ident") {
    return condition.name;
  }
  if (condition.kind === "paren") {
    return unwrapIdent(condition.expr);
  }
  return null;
}

function unwrapNumber(condition: Condition): number | null {
  if (condition.kind === "number") {
    return condition.value;
  }
  if (condition.kind === "paren") {
    return unwrapNumber(condition.expr);
  }
  return null;
}

function reverseComparison(op: BinOp): BinOp {
  switch (op) {
    case "<":
      return ">";
    case "<=":
      return ">=";
    case ">":
      return "<";
    case ">=":
      return "<=";
    default:
      return op;
  }
}

function isPositiveCheck(op: BinOp, number: number): boolean {
  switch (op) {
    case ">":
      return number === 0;
    case ">=":
      return number === 1;
    case "!=":
      return number === 0;
    default:
      return false;
  }
}

function isZeroCheck(op: BinOp, number: number): boolean {
  switch (op) {
    case "=":
    case "==":
      return number === 0;
    case "<=":
      return number === 0;
    case "<":
      return number === 1;
    default:
      return false;
  }
}

function lastSegment(value: string): string {
  const segments = value.split(".");
  return segments[segments.length - 1] ?? "";
}
