import { parseAtomKey } from "./atom-key";
import type { AtomParts, ConditionAtomValueKind } from "./types";

const BOOLEAN_PROPERTIES = new Set([
  "",
  "active",
  "down",
  "enabled",
  "exists",
  "ready",
  "ticking",
  "up",
  "usable",
]);

const NUMERIC_PROPERTIES = new Set([
  "amount",
  "charges",
  "count",
  "duration",
  "execute_time",
  "full_recharge_time",
  "max",
  "min",
  "pct",
  "rank",
  "react",
  "recharge_time",
  "remains",
  "stack",
  "stacks",
  "time_to_die",
  "value",
]);

export function inferAtomValueKind(
  key: string,
  usage: ConditionAtomValueKind = "boolean",
): ConditionAtomValueKind {
  const parts = parseAtomKey(key);
  const semanticKind = inferFromParts(parts);
  return semanticKind ?? usage;
}

function inferFromParts(
  parts: AtomParts,
): ConditionAtomValueKind | undefined {
  if (parts.namespace === "talent") {
    return parts.property === "rank" ? "number" : "boolean";
  }

  if (parts.namespace === "action" && parts.property === "cooldown") {
    return undefined;
  }

  if (
    parts.namespace === "cooldown" &&
    parts.subject.length > 0 &&
    parts.property.length === 0
  ) {
    return undefined;
  }

  const propertyTail = lastSegment(parts.property || parts.subject);
  if (NUMERIC_PROPERTIES.has(propertyTail)) {
    return "number";
  }
  if (BOOLEAN_PROPERTIES.has(propertyTail)) {
    return "boolean";
  }
  if (
    propertyTail.endsWith("_pct") ||
    propertyTail.endsWith("_remains") ||
    propertyTail.endsWith("_time")
  ) {
    return "number";
  }
  return undefined;
}

function lastSegment(value: string): string {
  const segments = value.split(".");
  return segments[segments.length - 1] ?? "";
}
