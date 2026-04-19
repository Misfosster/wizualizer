import { test, expect } from "@playwright/test";
import { parseAction } from "../../src/utils/apl-parser/parser";
import type { Action } from "../../src/utils/apl-parser/types";
import { evaluateActionEligibility } from "../../src/utils/talents/action-eligibility";

function parseOrThrow(line: string): Action {
  const action = parseAction(line);
  if (!action) {
    throw new Error(`parseAction returned null for line: ${line}`);
  }

  return action;
}

test("action with no eligibility segments is normal", () => {
  const action = parseOrThrow("actions+=/bloodlust");
  expect(evaluateActionEligibility(action, {})).toBe("normal");
});

test("action with if=true is normal", () => {
  const action = parseOrThrow("actions+=/bloodlust,if=talent.foo");
  expect(evaluateActionEligibility(action, { foo: 1 })).toBe("normal");
});

test("action with if=false is impossible", () => {
  const action = parseOrThrow("actions+=/bloodlust,if=talent.foo");
  expect(evaluateActionEligibility(action, {})).toBe("impossible");
});

test("action with if=unknown is unknown", () => {
  const action = parseOrThrow("actions+=/bloodlust,if=buff.x.up");
  expect(evaluateActionEligibility(action, {})).toBe("unknown");
});

test("if=talent.a&buff.x.up is impossible when talent is missing, unknown when present", () => {
  const action = parseOrThrow("actions+=/x,if=talent.a&buff.x.up");
  expect(evaluateActionEligibility(action, {})).toBe("impossible");
  expect(evaluateActionEligibility(action, { a: 1 })).toBe("unknown");
});

test("target_if=<expr> is treated as a filter and can mark impossible", () => {
  const action = parseOrThrow("actions+=/x,target_if=talent.foo");
  expect(evaluateActionEligibility(action, {})).toBe("impossible");
  expect(evaluateActionEligibility(action, { foo: 1 })).toBe("normal");
});

test("if and target_if combine: any provably-false segment makes impossible", () => {
  const action = parseOrThrow(
    "actions+=/x,if=talent.a,target_if=talent.b",
  );
  expect(evaluateActionEligibility(action, { a: 1, b: 1 })).toBe("normal");
  expect(evaluateActionEligibility(action, { a: 0, b: 1 })).toBe("impossible");
  expect(evaluateActionEligibility(action, { a: 1, b: 0 })).toBe("impossible");
});

test("non-eligibility segments do not affect classification", () => {
  const action = parseOrThrow(
    "actions+=/use_item,name=treacherous_transmitter,if=talent.foo",
  );
  expect(evaluateActionEligibility(action, { foo: 1 })).toBe("normal");
  expect(evaluateActionEligibility(action, {})).toBe("impossible");
});

test("numeric truthiness: if=0 is impossible, if=1 is normal", () => {
  const impossible = parseOrThrow("actions+=/x,if=talent.foo.rank");
  expect(evaluateActionEligibility(impossible, { foo: 0 })).toBe("impossible");
  expect(evaluateActionEligibility(impossible, { foo: 2 })).toBe("normal");
});
