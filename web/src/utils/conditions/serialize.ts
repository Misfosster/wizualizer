import {
  EMPTY_ATOM_OVERRIDES,
  EMPTY_CONDITION_OVERRIDES,
  type AtomOverrides,
  type AtomOverrideValue,
  type ConditionOverrides,
  type NumericOverrideOperator,
} from "./types";

/**
 * Convert `ConditionOverrides` to/from a JSON string suitable for
 * `localStorage`. Validation is intentionally strict: anything that
 * doesn't match the v1 shape is treated as "no overrides" rather than
 * thrown, so a stale or hand-edited blob never bricks the editor.
 *
 * Versioning: the on-disk envelope carries `{"v": 1, ...}` so we can
 * migrate forward without losing user intent. The current loader knows
 * v1 only; future versions add more cases.
 */

const CURRENT_VERSION = 1;

interface SerializedV1 {
  v: 1;
  global?: Record<string, AtomOverrideValue>;
  byProfile?: Record<string, Record<string, AtomOverrideValue>>;
}

export function serializeConditionOverrides(
  overrides: ConditionOverrides,
): string {
  const payload: SerializedV1 = {
    v: CURRENT_VERSION,
    global: toPlainOverrides(overrides.global),
    byProfile: toPlainByProfile(overrides.byProfile),
  };
  return JSON.stringify(payload);
}

export function deserializeConditionOverrides(
  raw: string | null,
): ConditionOverrides {
  if (!raw) {
    return EMPTY_CONDITION_OVERRIDES;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_CONDITION_OVERRIDES;
  }

  if (!isPlainRecord(parsed)) {
    return EMPTY_CONDITION_OVERRIDES;
  }
  if (parsed.v !== CURRENT_VERSION) {
    return EMPTY_CONDITION_OVERRIDES;
  }

  const global = readAtomOverrides(parsed.global);
  const byProfile = readByProfile(parsed.byProfile);
  if (
    Object.keys(global).length === 0 &&
    Object.keys(byProfile).length === 0
  ) {
    return EMPTY_CONDITION_OVERRIDES;
  }

  return { global, byProfile };
}

function toPlainOverrides(
  overrides: AtomOverrides,
): Record<string, AtomOverrideValue> | undefined {
  const keys = Object.keys(overrides);
  if (keys.length === 0) {
    return undefined;
  }
  const out: Record<string, AtomOverrideValue> = {};
  for (const key of keys) {
    const value = overrides[key];
    if (isValidOverrideValue(value)) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function toPlainByProfile(
  byProfile: Readonly<Record<string, AtomOverrides>>,
): Record<string, Record<string, AtomOverrideValue>> | undefined {
  const out: Record<string, Record<string, AtomOverrideValue>> = {};
  for (const profileName of Object.keys(byProfile)) {
    const overrides = byProfile[profileName] ?? EMPTY_ATOM_OVERRIDES;
    const plain = toPlainOverrides(overrides);
    if (plain) {
      out[profileName] = plain;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readAtomOverrides(value: unknown): AtomOverrides {
  if (!isPlainRecord(value)) {
    return EMPTY_ATOM_OVERRIDES;
  }
  const out: Record<string, AtomOverrideValue> = {};
  for (const key of Object.keys(value)) {
    const candidate = value[key];
    if (isValidOverrideValue(candidate)) {
      out[key] = candidate;
    }
  }
  return out;
}

function readByProfile(
  value: unknown,
): Readonly<Record<string, AtomOverrides>> {
  if (!isPlainRecord(value)) {
    return {};
  }
  const out: Record<string, AtomOverrides> = {};
  for (const key of Object.keys(value)) {
    const overrides = readAtomOverrides(value[key]);
    if (Object.keys(overrides).length > 0) {
      out[key] = overrides;
    }
  }
  return out;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isValidOverrideValue(value: unknown): value is AtomOverrideValue {
  return (
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    isValidNumericComparisonOverride(value)
  );
}

function isValidNumericComparisonOverride(
  value: unknown,
): value is { kind: "comparison"; op: NumericOverrideOperator; value: number } {
  if (!isPlainRecord(value)) {
    return false;
  }
  if (value.kind !== "comparison") {
    return false;
  }
  const op = value.op;
  if (op !== "=" && op !== "<" && op !== "<=" && op !== ">" && op !== ">=") {
    return false;
  }
  return typeof value.value === "number" && Number.isFinite(value.value);
}
