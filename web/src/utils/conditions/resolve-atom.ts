import type { IdentRef } from "@/utils/apl-parser/types";
import {
  UNKNOWN_VALUE,
  boolValue,
  numberValue,
  type EvalValue,
} from "@/utils/talents/types";
import { canonicalAtomKey, parseAtomKey } from "./atom-key";
import type { AtomOverrideValue, AtomOverrides } from "./types";

const STRICT_COMPARISON_EPSILON = 1e-6;

/**
 * Resolve a single condition atom to a concrete `EvalValue` using the
 * layered lookup defined for the override system:
 *
 *   talent.* atoms ->  global override (if set)
 *                  ->  decoded rank from `talents=` (if available)
 *                  ->  unknown
 *
 *   anything else  ->  profile override (if set)
 *                  ->  global override (if set)
 *                  ->  unknown
 *
 * Booleans returned by overrides are projected into the same shape the
 * evaluator already understands (`bool` for presence/enabled/non-talent,
 * `number` for `talent.<key>.rank`), so the rest of the evaluator does
 * not need to care which layer produced the value.
 */
export interface ProfileResolutionContext {
  /** Decoded `simcKey -> rank` map for this profile, or empty. */
  selections: Readonly<Record<string, number>>;
  /**
   * Whether `selections` represents a successful decode. When `false`,
   * a missing key means "we don't know what was picked" (stay
   * `unknown`) rather than "rank is zero" - overrides are the only
   * way to assert truth about `talent.*` atoms in that state.
   * Defaults to `true` so the legacy decoded-only callers are
   * unchanged.
   */
  selectionsTrusted?: boolean;
  /** Document-wide overrides; allowed to override talents. */
  globalOverrides: AtomOverrides;
  /** Per-profile overrides; only consulted for non-talent atoms. */
  profileOverrides: AtomOverrides;
}

export function resolveAtom(
  ident: IdentRef,
  context: ProfileResolutionContext,
): EvalValue {
  const key = canonicalAtomKey(ident.name);
  if (key.length === 0) {
    return UNKNOWN_VALUE;
  }

  const parts = parseAtomKey(key);
  if (parts.namespace === "talent") {
    return resolveTalentAtom(key, parts.subject, parts.property, context);
  }

  return resolveNonTalentAtom(key, context);
}

function resolveTalentAtom(
  key: string,
  subject: string,
  property: string,
  context: ProfileResolutionContext,
): EvalValue {
  const override = context.globalOverrides[key];
  if (isOverrideSet(override)) {
    if (property === "rank") {
      // A boolean override on a rank atom maps to 0 / 1 so comparisons
      // (`talent.foo.rank>=2`) still produce a definite truth value.
      return numberValue(toNumber(override));
    }
    return boolValue(toBoolean(override));
  }

  if (subject.length === 0) {
    return UNKNOWN_VALUE;
  }

  const trusted = context.selectionsTrusted !== false;
  if (!trusted && !(subject in context.selections)) {
    return UNKNOWN_VALUE;
  }

  const rank = context.selections[subject] ?? 0;
  if (property === "rank") {
    return numberValue(rank);
  }
  if (property === "" || property === "enabled") {
    return boolValue(rank > 0);
  }

  // Unknown talent.* sub-namespace - leave as unknown rather than make
  // up a value, matching the legacy evaluator's defensive behaviour.
  return UNKNOWN_VALUE;
}

function resolveNonTalentAtom(
  key: string,
  context: ProfileResolutionContext,
): EvalValue {
  const profileOverride = resolveLayerOverride(key, context.profileOverrides);
  if (profileOverride) return profileOverride;

  const globalOverride = resolveLayerOverride(key, context.globalOverrides);
  if (globalOverride) return globalOverride;

  return UNKNOWN_VALUE;
}

function resolveLayerOverride(
  key: string,
  overrides: AtomOverrides,
): EvalValue | null {
  const exact = overrides[key];
  if (isOverrideSet(exact)) {
    return toEvalValue(exact);
  }
  return resolveAliasOverride(key, overrides);
}

function resolveAliasOverride(
  key: string,
  overrides: AtomOverrides,
): EvalValue | null {
  const parts = parseAtomKey(key);
  const property = lastSegment(parts.property);

  if (parts.namespace === "buff" || parts.namespace === "debuff") {
    return resolveAuraAlias(parts.namespace, parts.subject, property, overrides);
  }

  if (parts.namespace === "dot") {
    return resolveDotAlias(parts.subject, property, overrides);
  }

  if (parts.namespace === "cooldown") {
    return resolveCooldownAlias(parts.subject, property || "up", overrides);
  }

  if (parts.namespace === "action" && parts.property === "cooldown") {
    return resolveActionCooldownAlias(parts.subject, overrides);
  }

  return null;
}

function resolveAuraAlias(
  namespace: string,
  subject: string,
  property: string,
  overrides: AtomOverrides,
): EvalValue | null {
  if (!subject) return null;

  if (property === "up") {
    const down = overrideAt(overrides, `${namespace}.${subject}.down`);
    if (isOverrideSet(down)) return boolValue(!toBoolean(down));
    const quantity = firstSetOverride(overrides, [
      `${namespace}.${subject}.stacks`,
      `${namespace}.${subject}.stack`,
      `${namespace}.${subject}.react`,
      `${namespace}.${subject}.remains`,
    ]);
    return isOverrideSet(quantity) ? boolValue(toNumber(quantity) > 0) : null;
  }

  if (property === "down") {
    const up = overrideAt(overrides, `${namespace}.${subject}.up`);
    if (isOverrideSet(up)) return boolValue(!toBoolean(up));
    const quantity = firstSetOverride(overrides, [
      `${namespace}.${subject}.stacks`,
      `${namespace}.${subject}.stack`,
      `${namespace}.${subject}.react`,
      `${namespace}.${subject}.remains`,
    ]);
    return isOverrideSet(quantity) ? boolValue(toNumber(quantity) <= 0) : null;
  }

  if (
    property === "stacks" ||
    property === "stack" ||
    property === "react" ||
    property === "remains"
  ) {
    const up = overrideAt(overrides, `${namespace}.${subject}.up`);
    if (isOverrideSet(up)) return numberValue(toBoolean(up) ? 1 : 0);
    const down = overrideAt(overrides, `${namespace}.${subject}.down`);
    if (isOverrideSet(down)) return numberValue(toBoolean(down) ? 0 : 1);
  }

  return null;
}

function resolveDotAlias(
  subject: string,
  property: string,
  overrides: AtomOverrides,
): EvalValue | null {
  if (!subject) return null;

  if (property === "ticking") {
    const remains = overrideAt(overrides, `dot.${subject}.remains`);
    return isOverrideSet(remains) ? boolValue(toNumber(remains) > 0) : null;
  }

  if (property === "remains") {
    const ticking = overrideAt(overrides, `dot.${subject}.ticking`);
    return isOverrideSet(ticking)
      ? numberValue(toBoolean(ticking) ? 1 : 0)
      : null;
  }

  return null;
}

function resolveCooldownAlias(
  subject: string,
  property: string,
  overrides: AtomOverrides,
): EvalValue | null {
  if (!subject) return null;

  if (property === "up") {
    const down = overrideAt(overrides, `cooldown.${subject}.down`);
    if (isOverrideSet(down)) return boolValue(!toBoolean(down));
    const remains = overrideAt(overrides, `cooldown.${subject}.remains`);
    if (isOverrideSet(remains)) return boolValue(toNumber(remains) <= 0);
    const actionCooldown = overrideAt(overrides, `action.${subject}.cooldown`);
    return isOverrideSet(actionCooldown)
      ? boolValue(toBoolean(actionCooldown))
      : null;
  }

  if (property === "down") {
    const up = overrideAt(overrides, `cooldown.${subject}.up`);
    if (isOverrideSet(up)) return boolValue(!toBoolean(up));
    const remains = overrideAt(overrides, `cooldown.${subject}.remains`);
    if (isOverrideSet(remains)) return boolValue(toNumber(remains) > 0);
    const actionCooldown = overrideAt(overrides, `action.${subject}.cooldown`);
    return isOverrideSet(actionCooldown)
      ? boolValue(!toBoolean(actionCooldown))
      : null;
  }

  if (property === "remains") {
    const up = firstSetOverride(overrides, [
      `cooldown.${subject}.up`,
      `action.${subject}.cooldown`,
    ]);
    if (isOverrideSet(up)) return numberValue(toBoolean(up) ? 0 : 1);
    const down = overrideAt(overrides, `cooldown.${subject}.down`);
    if (isOverrideSet(down)) return numberValue(toBoolean(down) ? 1 : 0);
  }

  return null;
}

function resolveActionCooldownAlias(
  subject: string,
  overrides: AtomOverrides,
): EvalValue | null {
  if (!subject) return null;
  const up = overrideAt(overrides, `cooldown.${subject}.up`);
  if (isOverrideSet(up)) return boolValue(toBoolean(up));
  const down = overrideAt(overrides, `cooldown.${subject}.down`);
  if (isOverrideSet(down)) return boolValue(!toBoolean(down));
  const remains = overrideAt(overrides, `cooldown.${subject}.remains`);
  return isOverrideSet(remains) ? boolValue(toNumber(remains) <= 0) : null;
}

function overrideAt(
  overrides: AtomOverrides,
  key: string,
): AtomOverrideValue | undefined {
  return overrides[key];
}

function firstSetOverride(
  overrides: AtomOverrides,
  keys: readonly string[],
): AtomOverrideValue | undefined {
  for (const key of keys) {
    const value = overrideAt(overrides, key);
    if (isOverrideSet(value)) return value;
  }
  return undefined;
}

function isOverrideSet(
  value: AtomOverrideValue | undefined,
): value is AtomOverrideValue {
  return (
    typeof value === "boolean" ||
    typeof value === "number" ||
    isNumericComparisonOverride(value)
  );
}

function toEvalValue(value: AtomOverrideValue): EvalValue {
  return typeof value === "boolean"
    ? boolValue(value)
    : numberValue(toNumber(value));
}

function toNumber(value: AtomOverrideValue): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  switch (value.op) {
    case ">":
      return value.value + STRICT_COMPARISON_EPSILON;
    case "<":
      return value.value - STRICT_COMPARISON_EPSILON;
    case "=":
    case ">=":
    case "<=":
      return value.value;
  }
}

function toBoolean(value: AtomOverrideValue): boolean {
  return typeof value === "boolean" ? value : toNumber(value) !== 0;
}

function isNumericComparisonOverride(
  value: AtomOverrideValue | undefined,
): value is { kind: "comparison"; op: "=" | "<" | "<=" | ">" | ">="; value: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    value.kind === "comparison" &&
    (value.op === "=" ||
      value.op === "<" ||
      value.op === "<=" ||
      value.op === ">" ||
      value.op === ">=") &&
    typeof value.value === "number" &&
    Number.isFinite(value.value)
  );
}

function lastSegment(value: string): string {
  const segments = value.split(".");
  return segments[segments.length - 1] ?? "";
}
