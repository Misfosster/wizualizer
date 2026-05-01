import { isTargetRankingSegment } from "@/utils/apl-parser/action-data";
import type { Condition, IdentRef, Segment } from "@/utils/apl-parser/types";
import { canonicalAtomKey, parseAtomKey } from "@/utils/conditions/atom-key";
import {
  evaluateConditionWith,
  type AtomResolver,
} from "@/utils/talents/evaluate-condition";
import {
  UNKNOWN_VALUE,
  boolValue,
  numberValue,
  type EvalValue,
} from "@/utils/talents/types";
import type { SemanticSpecCatalog } from "@/utils/semantics/types";

type SelfAvailabilityAtomKind = "ready" | "down" | "remains" | "charges";
type ComparisonOp = "<" | "<=" | ">" | ">=" | "=" | "==" | "!=";

export interface SelfActionAvailabilityContext {
  catalog?: SemanticSpecCatalog;
  resolveAtom?: AtomResolver;
}

export function findSelfAvailabilityFailure(
  spell: string,
  segments: readonly Segment[],
  context: SelfActionAvailabilityContext = {},
): Segment | undefined {
  const resolve = makeSelfAvailabilityResolver(spell, context);
  for (const segment of segments) {
    if (segment.type !== "if" && segment.type !== "target_if") {
      continue;
    }
    if (isTargetRankingSegment(segment)) {
      continue;
    }
    if (!conditionReferencesSelfAvailability(segment.expr, spell, context.catalog)) {
      continue;
    }
    const result = evaluateConditionWith(segment.expr, resolve);
    if (isFalseValue(result)) {
      return segment;
    }
    if (
      conditionRequiresSelfUnavailable(
        segment.expr,
        spell,
        context.catalog,
      )
    ) {
      return segment;
    }
  }
  return undefined;
}

function conditionReferencesSelfAvailability(
  condition: Condition,
  spell: string,
  catalog: SemanticSpecCatalog | undefined,
): boolean {
  switch (condition.kind) {
    case "ident":
      return conditionSelfAtomKind(condition, spell, catalog) !== null;
    case "number":
    case "sequence":
      return false;
    case "paren":
      return conditionReferencesSelfAvailability(condition.expr, spell, catalog);
    case "unary":
      return conditionReferencesSelfAvailability(condition.expr, spell, catalog);
    case "binary":
      return (
        conditionReferencesSelfAvailability(condition.left, spell, catalog) ||
        conditionReferencesSelfAvailability(condition.right, spell, catalog)
      );
    case "call":
      return condition.args.some((arg) =>
        conditionReferencesSelfAvailability(arg, spell, catalog),
      );
  }
}

function makeSelfAvailabilityResolver(
  spell: string,
  context: SelfActionAvailabilityContext,
): AtomResolver {
  return (ident) => {
    const selfValue = resolveSelfAvailabilityAtom(
      ident,
      spell,
      context.catalog,
    );
    if (selfValue) {
      return selfValue;
    }
    return context.resolveAtom?.(ident) ?? UNKNOWN_VALUE;
  };
}

function resolveSelfAvailabilityAtom(
  ident: IdentRef,
  spell: string,
  catalog: SemanticSpecCatalog | undefined,
): EvalValue | null {
  const kind = conditionSelfAtomKind(ident, spell, catalog);
  switch (kind) {
    case "ready":
      return boolValue(true);
    case "down":
      return boolValue(false);
    case "remains":
      return numberValue(0);
    case "charges":
      // Available only proves charges > 0. It does not prove an exact count.
      return UNKNOWN_VALUE;
    case null:
      return null;
  }
}

function conditionRequiresSelfUnavailable(
  condition: Condition,
  spell: string,
  catalog: SemanticSpecCatalog | undefined,
): boolean {
  switch (condition.kind) {
    case "ident": {
      const kind = conditionSelfAtomKind(condition, spell, catalog);
      return kind === "down" || kind === "remains";
    }
    case "number":
    case "sequence":
    case "call":
      return false;
    case "paren":
      return conditionRequiresSelfUnavailable(
        condition.expr,
        spell,
        catalog,
      );
    case "unary":
      return (
        condition.op === "!" &&
        conditionRequiresSelfAvailable(condition.expr, spell, catalog)
      );
    case "binary":
      if (condition.op === "&") {
        return (
          conditionRequiresSelfUnavailable(condition.left, spell, catalog) ||
          conditionRequiresSelfUnavailable(condition.right, spell, catalog)
        );
      }
      if (condition.op === "|") {
        return (
          conditionRequiresSelfUnavailable(condition.left, spell, catalog) &&
          conditionRequiresSelfUnavailable(condition.right, spell, catalog)
        );
      }
      return comparisonRequiresSelfUnavailable(condition, spell, catalog);
  }
}

function conditionRequiresSelfAvailable(
  condition: Condition,
  spell: string,
  catalog: SemanticSpecCatalog | undefined,
): boolean {
  switch (condition.kind) {
    case "ident": {
      const kind = conditionSelfAtomKind(condition, spell, catalog);
      return kind === "ready" || kind === "charges";
    }
    case "number":
    case "sequence":
    case "call":
      return false;
    case "paren":
      return conditionRequiresSelfAvailable(condition.expr, spell, catalog);
    case "unary":
      return (
        condition.op === "!" &&
        conditionRequiresSelfUnavailable(condition.expr, spell, catalog)
      );
    case "binary":
      if (condition.op === "&") {
        return (
          conditionRequiresSelfAvailable(condition.left, spell, catalog) ||
          conditionRequiresSelfAvailable(condition.right, spell, catalog)
        );
      }
      if (condition.op === "|") {
        return (
          conditionRequiresSelfAvailable(condition.left, spell, catalog) &&
          conditionRequiresSelfAvailable(condition.right, spell, catalog)
        );
      }
      return comparisonRequiresSelfAvailable(condition, spell, catalog);
  }
}

function comparisonRequiresSelfUnavailable(
  condition: Extract<Condition, { kind: "binary" }>,
  spell: string,
  catalog: SemanticSpecCatalog | undefined,
): boolean {
  const leftKind = conditionSelfAtomKind(condition.left, spell, catalog);
  const rightNumber = conditionNumber(condition.right);
  if (leftKind && rightNumber !== null) {
    return atomComparisonRequiresUnavailable(
      leftKind,
      condition.op,
      rightNumber,
    );
  }

  const rightKind = conditionSelfAtomKind(condition.right, spell, catalog);
  const leftNumber = conditionNumber(condition.left);
  const reversedOp = reverseComparisonOp(condition.op);
  if (rightKind && leftNumber !== null && reversedOp) {
    return atomComparisonRequiresUnavailable(rightKind, reversedOp, leftNumber);
  }

  return false;
}

function comparisonRequiresSelfAvailable(
  condition: Extract<Condition, { kind: "binary" }>,
  spell: string,
  catalog: SemanticSpecCatalog | undefined,
): boolean {
  const leftKind = conditionSelfAtomKind(condition.left, spell, catalog);
  const rightNumber = conditionNumber(condition.right);
  if (leftKind && rightNumber !== null) {
    return atomComparisonRequiresAvailable(
      leftKind,
      condition.op,
      rightNumber,
    );
  }

  const rightKind = conditionSelfAtomKind(condition.right, spell, catalog);
  const leftNumber = conditionNumber(condition.left);
  const reversedOp = reverseComparisonOp(condition.op);
  if (rightKind && leftNumber !== null && reversedOp) {
    return atomComparisonRequiresAvailable(rightKind, reversedOp, leftNumber);
  }

  return false;
}

function conditionSelfAtomKind(
  condition: Condition,
  spell: string,
  catalog: SemanticSpecCatalog | undefined,
): SelfAvailabilityAtomKind | null {
  if (condition.kind !== "ident") {
    return null;
  }

  const key = canonicalAtomKey(condition.name);
  const spellKey = canonicalAtomKey(spell);
  const parts = parseAtomKey(key);

  const property = lastPropertySegment(parts.property);
  if (parts.namespace === "action") {
    if (parts.subject !== spellKey) {
      return null;
    }
    if (property === "ready" || property === "cooldown") {
      return "ready";
    }
    return null;
  }

  if (parts.namespace !== "cooldown") {
    return null;
  }
  if (!isSelfCooldownSubject(parts.subject, spellKey, catalog)) {
    return null;
  }

  if (property === "" || property === "ready" || property === "up") {
    return "ready";
  }
  if (property === "down") {
    return "down";
  }
  if (property === "remains") {
    return "remains";
  }
  if (property === "charges") {
    return "charges";
  }

  return null;
}

function isSelfCooldownSubject(
  subject: string,
  spellKey: string,
  catalog: SemanticSpecCatalog | undefined,
): boolean {
  if (subject === spellKey) {
    return true;
  }
  if (!catalog) {
    return false;
  }

  const actionNames = new Set(catalog.actions.map(canonicalAtomKey));
  if (!actionNames.has(spellKey)) {
    return false;
  }

  const cooldownNames = new Set(catalog.cooldowns.map(canonicalAtomKey));
  if (!cooldownNames.has(subject)) {
    return false;
  }

  return isLikelySharedCooldownAlias(spellKey, subject);
}

function isLikelySharedCooldownAlias(spellKey: string, cooldownKey: string): boolean {
  if (cooldownKey === spellKey) {
    return true;
  }
  if (cooldownKey.length < 5) {
    return false;
  }
  return (
    spellKey.endsWith(cooldownKey) ||
    spellKey.startsWith(`${cooldownKey}_`) ||
    cooldownKey.startsWith(`${spellKey}_`)
  );
}

function atomComparisonRequiresUnavailable(
  kind: SelfAvailabilityAtomKind,
  op: string,
  value: number,
): boolean {
  if (!isComparisonOp(op)) {
    return false;
  }

  switch (kind) {
    case "remains":
      return (
        (op === ">" && value >= 0) ||
        (op === ">=" && value > 0) ||
        (op === "!=" && value === 0)
      );
    case "down":
      return (
        ((op === "=" || op === "==") && value === 1) ||
        (op === ">" && value >= 0 && value < 1) ||
        (op === ">=" && value > 0 && value <= 1) ||
        (op === "!=" && value === 0)
      );
    case "ready":
      return (
        ((op === "=" || op === "==") && value === 0) ||
        (op === "<" && value > 0 && value <= 1) ||
        (op === "<=" && value >= 0 && value < 1) ||
        (op === "!=" && value === 1)
      );
    case "charges":
      return (
        ((op === "=" || op === "==") && value === 0) ||
        (op === "<" && value > 0 && value <= 1) ||
        (op === "<=" && value >= 0 && value < 1)
      );
  }
}

function atomComparisonRequiresAvailable(
  kind: SelfAvailabilityAtomKind,
  op: string,
  value: number,
): boolean {
  if (!isComparisonOp(op)) {
    return false;
  }

  switch (kind) {
    case "remains":
      return (
        ((op === "=" || op === "==") && value === 0) ||
        (op === "<=" && value === 0)
      );
    case "down":
      return (
        ((op === "=" || op === "==") && value === 0) ||
        (op === "<" && value > 0 && value <= 1) ||
        (op === "<=" && value >= 0 && value < 1) ||
        (op === "!=" && value === 1)
      );
    case "ready":
      return (
        ((op === "=" || op === "==") && value === 1) ||
        (op === ">" && value >= 0 && value < 1) ||
        (op === ">=" && value > 0 && value <= 1) ||
        (op === "!=" && value === 0)
      );
    case "charges":
      return (
        ((op === "=" || op === "==") && value > 0) ||
        (op === ">" && value >= 0 && value < 1) ||
        (op === ">=" && value > 0 && value <= 1) ||
        (op === "!=" && value === 0)
      );
  }
}

function conditionNumber(condition: Condition): number | null {
  return condition.kind === "number" ? condition.value : null;
}

function isComparisonOp(op: string): op is ComparisonOp {
  return (
    op === "<" ||
    op === "<=" ||
    op === ">" ||
    op === ">=" ||
    op === "=" ||
    op === "==" ||
    op === "!="
  );
}

function reverseComparisonOp(op: string): ComparisonOp | null {
  switch (op) {
    case "<":
      return ">";
    case "<=":
      return ">=";
    case ">":
      return "<";
    case ">=":
      return "<=";
    case "=":
    case "==":
    case "!=":
      return op;
    default:
      return null;
  }
}

function lastPropertySegment(property: string): string {
  const segments = property.split(".");
  return segments[segments.length - 1] ?? "";
}

function isFalseValue(value: EvalValue): boolean {
  if (value.kind === "bool") {
    return !value.value;
  }
  return value.kind === "number" && value.value === 0;
}
