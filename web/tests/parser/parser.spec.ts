import { test, expect } from "@playwright/test";
import { parseAction, parseConditionFromText } from "../../src/utils/apl-parser/parser";
import { applySchema, DEFAULT_SCHEMA } from "../../src/utils/apl-parser/schema";

// Structural parse: capture raw key/value segments without interpretation.
test("parseAction captures raw arg values", () => {
  const line =
    "actions.item+=/use_item,name=treacherous_transmitter,use_off_gcd=1";
  const action = parseAction(line);
  expect(action).not.toBeNull();
  if (!action) return;

  expect(action.category).toBe("actions.item");
  expect(action.op).toBe("+=");
  expect(action.spell).toBe("use_item");
  expect(action.segments).toEqual([
    { kind: "arg", key: "name", valueRaw: "treacherous_transmitter" },
    { kind: "arg", key: "use_off_gcd", valueRaw: "1" },
  ]);
});

// Positional segments should be preserved for sequence-style actions.
test("parseAction supports positional segments", () => {
  const line = "actions.opener=sequence,shadowstrike,backstab";
  const action = parseAction(line);
  expect(action).not.toBeNull();
  if (!action) return;

  expect(action.spell).toBe("sequence");
  expect(action.segments).toEqual([
    { kind: "positional", valueRaw: "shadowstrike" },
    { kind: "positional", valueRaw: "backstab" },
  ]);
});

// Raw values keep parentheses so schema/expression parsing can interpret later.
test("raw values preserve parentheses", () => {
  const line = "actions+=/variable,name=foo,value=(a|b)&c";
  const action = parseAction(line);
  expect(action).not.toBeNull();
  if (!action) return;

  expect(action.segments).toEqual([
    { kind: "arg", key: "name", valueRaw: "foo" },
    { kind: "arg", key: "value", valueRaw: "(a|b)&c" },
  ]);
});

// Schema layer interprets only keys marked as expressions (default: if/target_if).
test("schema interprets if as expression", () => {
  const line =
    "actions+=/call_action_list,name=finish,if=combo_points==cp_max_spend";
  const action = parseAction(line);
  expect(action).not.toBeNull();
  if (!action) return;

  const typed = applySchema(action, DEFAULT_SCHEMA);
  const ifSegment = typed.segments.find(
    (segment) => segment.kind === "arg" && segment.key === "if",
  );
  expect(ifSegment).toBeTruthy();
  if (ifSegment?.kind !== "arg") return;

  expect(ifSegment.value.kind).toBe("expr");
  if (ifSegment.value.kind !== "expr") return;

  expect(ifSegment.value.expr).toMatchObject({
    kind: "binary",
    op: "=",
  });
});

// Expression parser normalizes == into equality in the AST.
test("parseConditionFromText treats == as equality", () => {
  const expr = parseConditionFromText("combo_points==cp_max_spend");
  expect(expr).toMatchObject({
    kind: "binary",
    op: "=",
    left: { kind: "ident", name: "combo_points" },
    right: { kind: "ident", name: "cp_max_spend" },
  });
});
