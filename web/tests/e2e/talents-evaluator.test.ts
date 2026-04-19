import { test, expect } from "@playwright/test";
import { parseAction } from "../../src/utils/apl-parser/parser";
import type { Condition } from "../../src/utils/apl-parser/types";
import { evaluateCondition } from "../../src/utils/talents/evaluate-condition";
import type { EvalValue } from "../../src/utils/talents/types";

function parseIfCondition(line: string): Condition {
  const action = parseAction(line);
  if (!action) {
    throw new Error(`parseAction returned null for line: ${line}`);
  }

  for (const segment of action.segments) {
    if (segment.type === "if") {
      return segment.expr;
    }
  }

  throw new Error(`No if= segment found in line: ${line}`);
}

function evaluateIf(
  line: string,
  selections: Record<string, number>,
): EvalValue {
  return evaluateCondition(parseIfCondition(line), selections);
}

test("talent.<key> resolves to bool true when rank > 0", () => {
  const result = evaluateIf("actions+=/x,if=talent.hot_hand", {
    hot_hand: 1,
  });
  expect(result).toEqual({ kind: "bool", value: true });
});

test("talent.<key> resolves to bool false when missing or rank 0", () => {
  expect(evaluateIf("actions+=/x,if=talent.hot_hand", {})).toEqual({
    kind: "bool",
    value: false,
  });
  expect(
    evaluateIf("actions+=/x,if=talent.hot_hand", { hot_hand: 0 }),
  ).toEqual({ kind: "bool", value: false });
});

test("talent.<key>.enabled is the same as bare talent.<key>", () => {
  const bare = evaluateIf("actions+=/x,if=talent.hot_hand", { hot_hand: 1 });
  const enabled = evaluateIf("actions+=/x,if=talent.hot_hand.enabled", {
    hot_hand: 1,
  });
  expect(enabled).toEqual(bare);
});

test("talent.<key>.rank returns the numeric rank", () => {
  expect(evaluateIf("actions+=/x,if=talent.foo.rank", { foo: 2 })).toEqual({
    kind: "number",
    value: 2,
  });
  expect(evaluateIf("actions+=/x,if=talent.foo.rank", {})).toEqual({
    kind: "number",
    value: 0,
  });
});

test("!talent.<key> flips the boolean", () => {
  expect(evaluateIf("actions+=/x,if=!talent.hot_hand", {})).toEqual({
    kind: "bool",
    value: true,
  });
  expect(
    evaluateIf("actions+=/x,if=!talent.hot_hand", { hot_hand: 1 }),
  ).toEqual({ kind: "bool", value: false });
});

test("comparisons against talent.rank evaluate when both sides are known", () => {
  expect(evaluateIf("actions+=/x,if=talent.foo.rank>=2", { foo: 2 })).toEqual({
    kind: "bool",
    value: true,
  });
  expect(evaluateIf("actions+=/x,if=talent.foo.rank>=2", { foo: 1 })).toEqual({
    kind: "bool",
    value: false,
  });
});

test("non-talent identifiers reduce to unknown", () => {
  expect(evaluateIf("actions+=/x,if=buff.bloodlust.up", {})).toEqual({
    kind: "unknown",
  });
  expect(evaluateIf("actions+=/x,if=cooldown.foo.remains>0", {})).toEqual({
    kind: "unknown",
  });
  expect(evaluateIf("actions+=/x,if=variable.bar", {})).toEqual({
    kind: "unknown",
  });
});

test("AND short-circuits to false when one side is provably false", () => {
  expect(
    evaluateIf("actions+=/x,if=talent.foo&buff.x.up", { foo: 0 }),
  ).toEqual({ kind: "bool", value: false });
});

test("AND with one side true and the other unknown reduces to unknown", () => {
  expect(
    evaluateIf("actions+=/x,if=talent.foo&buff.x.up", { foo: 1 }),
  ).toEqual({ kind: "unknown" });
});

test("OR short-circuits to true when one side is provably true", () => {
  expect(
    evaluateIf("actions+=/x,if=talent.foo|buff.x.up", { foo: 1 }),
  ).toEqual({ kind: "bool", value: true });
});

test("OR with one side false and the other unknown reduces to unknown", () => {
  expect(
    evaluateIf("actions+=/x,if=talent.foo|buff.x.up", { foo: 0 }),
  ).toEqual({ kind: "unknown" });
});

test("XOR is unknown when either operand is unknown", () => {
  expect(
    evaluateIf("actions+=/x,if=talent.foo^buff.x.up", { foo: 1 }),
  ).toEqual({ kind: "unknown" });
  expect(
    evaluateIf("actions+=/x,if=talent.foo^talent.bar", { foo: 1, bar: 0 }),
  ).toEqual({ kind: "bool", value: true });
});

test("arithmetic on talent ranks folds when all operands are known", () => {
  expect(
    evaluateIf("actions+=/x,if=talent.foo.rank*2>=4", { foo: 2 }),
  ).toEqual({ kind: "bool", value: true });
  expect(
    evaluateIf("actions+=/x,if=talent.foo.rank*2>=4", { foo: 1 }),
  ).toEqual({ kind: "bool", value: false });
});

test("arithmetic involving non-talent operands reduces to unknown", () => {
  expect(
    evaluateIf("actions+=/x,if=talent.foo.rank+buff.x.stack>=2", { foo: 1 }),
  ).toEqual({ kind: "unknown" });
});

test("string operators always reduce to unknown", () => {
  expect(evaluateIf("actions+=/x,if=target.name~boss", {})).toEqual({
    kind: "unknown",
  });
  expect(evaluateIf("actions+=/x,if=target.name!~boss", {})).toEqual({
    kind: "unknown",
  });
});

test("floor and ceil fold against known talent ranks", () => {
  // SimC uses `%` for division (slash is not a parsed binary operator).
  expect(
    evaluateIf("actions+=/x,if=floor(talent.foo.rank%2)", { foo: 3 }),
  ).toEqual({ kind: "number", value: 1 });
  expect(
    evaluateIf("actions+=/x,if=ceil(talent.foo.rank%2)", { foo: 3 }),
  ).toEqual({ kind: "number", value: 2 });
});

test("floor and ceil stay unknown when their argument is unknown", () => {
  expect(evaluateIf("actions+=/x,if=floor(buff.x.stack%2)", {})).toEqual({
    kind: "unknown",
  });
});

test("parenthesized expressions evaluate transparently", () => {
  expect(
    evaluateIf("actions+=/x,if=(talent.foo&talent.bar)|talent.baz", {
      foo: 1,
      bar: 1,
      baz: 0,
    }),
  ).toEqual({ kind: "bool", value: true });
});

test("nested talent.<key> with sibling suffix is treated as unknown, not a false positive", () => {
  expect(
    evaluateIf("actions+=/x,if=talent.foo.something_else", { foo: 1 }),
  ).toEqual({ kind: "unknown" });
});
