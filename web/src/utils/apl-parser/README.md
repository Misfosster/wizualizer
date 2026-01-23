# APL Parser Flow

This parser is built as separate phases. The first phase only extracts fields.
Later phases interpret selected option values.

## Overview

Flow
1) Lexer (tokens)
2) Structural parse (ActionParsed, SegmentParsed)
3) Schema pass (ActionInterpreted, SegmentInterpreted)
4) Expression parsing (Condition AST) for selected keys

Only step 4 builds an expression tree. Steps 1-3 keep raw option text.

## Example Line

Input:
actions+=/call_action_list,name=finish,if=!buff.darkest_night.up&effective_combo_points>=6|buff.darkest_night.up&combo_points==cp_max_spend

### 1) Lexer (tokenization)

`web/src/utils/apl-parser/lexer.ts` converts the line into tokens like:
ident, number, comma, eq, eqEq, lparen, rparen, and operators.

Notes:
- `==` becomes `eqEq`, then maps to equality in the parser.
- All operator symbols (`+`, `-`, `*`, `/`, `!`, `&`, `|`, `<`, `<=`, `>`, `>=`, `=`, `==`) are their own tokens.
- Identifiers only allow letters, digits, `_`, and `.`; operators are never part of identifiers.

#### Lexer tokens (exact matches and patterns)

Fixed string tokens:
- `plusEqSlash` -> `"+=/"`
- `plusEq` -> `"+="`
- `eqEq` -> `"=="`
- `eq` -> `"="`
- `comma` -> `","`
- `plus` -> `"+"`
- `minus` -> `"-"`
- `mult` -> `"*"`
- `slash` -> `"/"`
- `lparen` -> `"("`
- `rparen` -> `")"`
- `and` -> `"&"`
- `or` -> `"|"`
- `not` -> `"!"`
- `le` -> `"<="`
- `ge` -> `">="`
- `lt` -> `"<"`
- `gt` -> `">"`

Regex tokens:
- `ws` -> `/[ \t]+/` (examples: `" "`, `"\t"`, `" \t "`)
- `nl` -> `/\r?\n/` (examples: `"\n"`, `"\r\n"`)
- `comment` -> `/#[^\n]*/` (examples: `"#comment"`, `"# comment here"`)
- `number` -> `/[0-9]+(?:\.[0-9]+)?/` (examples: `"0"`, `"42"`, `"3.14"`)
- `ident` -> `/[A-Za-z_][A-Za-z0-9_.]*/`
  (examples: `"actions"`, `"call_action_list"`, `"buff.shadow_dance.up"`)

Token handling in code:
- `tokenizeLine()` in `parser.ts` skips `ws`.
- `nl` does not appear when parsing a single line with `tokenizeLine()`.

### 2) Structural parse (raw fields)

`parseAction()` in `web/src/utils/apl-parser/parser.ts` returns an ActionParsed:

{
  category: "actions",
  op: "+=",
  spell: "call_action_list",
  segments: [
    { kind: "arg", key: "name", valueRaw: "finish" },
    { kind: "arg", key: "if", valueRaw: "!buff.darkest_night.up&effective_combo_points>=6|buff.darkest_night.up&combo_points==cp_max_spend" }
  ]
}

At this stage, all option values are stored as raw strings.

### 3) Schema pass (interpreted meaning)

`applySchema()` in `web/src/utils/apl-parser/schema.ts` converts ActionParsed into
ActionInterpreted using a schema (rules per key).

Default behavior:
- `if` and `target_if` are parsed as expressions.
- All other keys stay `raw` unless you add a schema entry.

Result (simplified):
segments:
  name -> { kind: "raw", value: "finish" }
  if   -> { kind: "expr", expr: Condition AST }

Diagnostics are produced here (missing required keys, invalid numbers, bad
expressions, etc).

### 4) Expression parsing (Condition AST)

`parseConditionFromText()` in `web/src/utils/apl-parser/parser.ts` converts the
raw `if` string into a Condition AST with operators and precedence.

Only keys marked as `expr` in the schema are parsed this way.

## Why this split?

- The raw parser does not rewrite values, so input can be serialized back out.
- The schema decides which keys are expressions vs strings vs numbers.
- Validation happens in one place (the schema pass).

## Debug Helpers

`web/src/utils/apl-parser/pretty-log.ts` formats ActionParsed back into a
readable string, which is useful for logging or debugging the structural parse.

## Extending the Schema

To interpret more keys, add them to the schema:

const schema: Schema = {
  actions: {
    use_item: {
      options: {
        name: { kind: "string", required: true },
        if: { kind: "expr" },
        use_off_gcd: { kind: "number" },
      },
    },
  },
};

Then pass it to `applySchema(actionParsed, schema)`.

## Schema Layer (Line-Referenced)

File: `web/src/utils/apl-parser/schema.ts`

Defaults:
- `DEFAULT_SCHEMA` marks `if` and `target_if` as expression keys: `web/src/utils/apl-parser/schema.ts:13-20`.

Entry point:
- `applySchema()` converts `ActionParsed` into `ActionInterpreted`: `web/src/utils/apl-parser/schema.ts:27-95`.
- Action-specific schema and defaults are merged here: `web/src/utils/apl-parser/schema.ts:32-37`.
- Each segment is interpreted via `parseValue()`: `web/src/utils/apl-parser/schema.ts:39-72`.
- Diagnostics are collected per segment: `web/src/utils/apl-parser/schema.ts:43-49` and `web/src/utils/apl-parser/schema.ts:60-65`.
- Required options are enforced after parsing: `web/src/utils/apl-parser/schema.ts:74-86`.

Value parsing:
- `parseValue()` handles conversion based on `OptionSchema`: `web/src/utils/apl-parser/schema.ts:97-154`.
- `expr` values call `parseConditionFromText()` in the parser: `web/src/utils/apl-parser/schema.ts:112-123`.
- `number` validates numeric input: `web/src/utils/apl-parser/schema.ts:125-135`.
- `enum` warns on unexpected values: `web/src/utils/apl-parser/schema.ts:136-144`.
- `list` defers to `parseList()`: `web/src/utils/apl-parser/schema.ts:145-149`.

Lists:
- `parseList()` splits values and optionally parses numbers: `web/src/utils/apl-parser/schema.ts:156-184`.

## AST Parsing (Line-Referenced)

File: `web/src/utils/apl-parser/parser.ts`

Entry point:
- `parseConditionFromText()` tokenizes and parses a full condition: `web/src/utils/apl-parser/parser.ts:93-106`.
- It errors if trailing tokens remain: `web/src/utils/apl-parser/parser.ts:100-105`.

Operator rules:
- `PREC` defines precedence for `|`, `&`, comparisons, and arithmetic: `web/src/utils/apl-parser/parser.ts:109-123`.
- `tokToBinOp()` maps tokens to operators (both `eqEq` and `eq` map to `=`): `web/src/utils/apl-parser/parser.ts:125-153`.

Expression parser:
- `parseCondition()` builds a binary tree using Pratt parsing: `web/src/utils/apl-parser/parser.ts:157-185`.
- It advances while operators meet precedence rules: `web/src/utils/apl-parser/parser.ts:160-173`.

Prefix parser:
- `parsePrefix()` handles `!`, parentheses, numbers, and identifiers: `web/src/utils/apl-parser/parser.ts:188-218`.
