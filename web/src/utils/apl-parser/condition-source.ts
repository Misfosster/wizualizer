import type { Condition } from "./types";

const CONDITION_SOURCE = new WeakMap<Condition, string>();

export function setConditionSource<T extends Condition>(
  condition: T,
  source: string | undefined,
): T {
  if (source) {
    CONDITION_SOURCE.set(condition, source);
  }

  return condition;
}

export function getConditionSource(condition: Condition): string | undefined {
  return CONDITION_SOURCE.get(condition);
}
