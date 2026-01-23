import type { Token } from "moo";
import lexer from "./lexer";
import type { ActionParsed, Condition, BinOp } from "./types";
import { TokenStream } from "./token-stream";

// tokenize line - whitespace is dropped
function tokenizeLine(line: string): Token[] {
  lexer.reset(line);
  const tokens: Token[] = [];
  for (const t of lexer) {
    if (t.type === "ws") {
      continue;
    }

    tokens.push(t);
  }

  return tokens;
}

// parse action line - raw structural shape
export function parseAction(line: string): ActionParsed | null {
  const tokens = tokenizeLine(line);

  // Empty or comments are not needed to parse
  if (tokens.length === 0 || tokens[0]?.type === "comment") {
    return null;
  }

  const ts = new TokenStream(tokens);
  const category = ts.expect("ident").value;

  // action operator - "=" or "+=/"
  const op: ActionParsed["op"] = ts.match("eq")
    ? "="
    : ts.match("plusEqSlash")
      ? "+="
      : (() => {
        throw new Error("Expected '=' or '+=/' after category");
      })();

  // Incase of uncaught slash (this fixes a bug)
  ts.match("slash");
  const spell = ts.expect("ident").value;

  const segments: ActionParsed["segments"] = [];

  while (ts.match("comma")) {
    // segment can be:
    // - key=<value> (if, target_if, name, use_off_gcd, etc.)
    // - <value> (positional, e.g. sequence steps)
    const keyTok = ts.peek();
    const isKey = keyTok?.type === "ident" && ts.peek(1)?.type === "eq";

    if (isKey) {
      const keyTok = ts.next();
      if (!keyTok) {
        throw new Error("Expected segment key");
      }
      const key = keyTok.value;
      ts.next(); // consume eq
      const valueRaw = readValueRaw(ts);
      segments.push({ kind: "arg", key, valueRaw });
      continue;
    }

    const valueRaw = readValueRaw(ts);
    segments.push({ kind: "positional", valueRaw });
  }

  return { category, spell, op, segments };
}

// read raw value - stop at comma when paren depth is 0
function readValueRaw(ts: TokenStream): string {
  const parts: string[] = [];
  let depth = 0;

  while (!ts.eof()) {
    const t = ts.peek();
    if (!t) break;
    if (t.type === "comma" && depth === 0) {
      break;
    }
    if (t.type === "lparen") {
      depth += 1;
    } else if (t.type === "rparen" && depth > 0) {
      depth -= 1;
    }
    ts.next();
    parts.push(t.value);
  }

  return parts.join("");
}

// parse condition string - ensure full consumption
export function parseConditionFromText(text: string): Condition {
  const tokens = tokenizeLine(text);
  if (tokens.length === 0) {
    throw new Error("Expected condition");
  }
  const ts = new TokenStream(tokens);
  const expr = parseCondition(ts, 0);
  if (!ts.eof()) {
    const t = ts.peek();
    throw new Error(
      `Unexpected token after condition: ${String(t?.type)} ${JSON.stringify(t?.value)}`,
    );
  }
  return expr;
}

// For precedence in math
const PREC: Partial<Record<string, number>> = {
  or: 1, // |
  and: 2, // &
  eqEq: 3,
  eq: 3,
  lt: 3,
  gt: 3,
  le: 3,
  ge: 3, // comparisons
  plus: 4,
  minus: 4,
  mult: 5,
  slash: 5,
};

function tokToBinOp(t: Token): BinOp | null {
  switch (t.type) {
    case "or":
      return "|";
    case "and":
      return "&";
    case "eqEq":
      return "=";
    case "eq":
      return "=";
    case "lt":
      return "<";
    case "gt":
      return ">";
    case "le":
      return "<=";
    case "ge":
      return ">=";
    case "plus":
      return "+";
    case "minus":
      return "-";
    case "mult":
      return "*";
    case "slash":
      return "/";
    default:
      return null;
  }
}

// https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
// pratt parser for binary expressions (left-associative)
function parseCondition(ts: TokenStream, minPrec = 0): Condition {
  let left = parsePrefix(ts);

  for (; ;) {
    const t = ts.peek(); // Check which operator
    if (!t) {
      break;
    }

    const type = t.type;
    if (!type) {
      break;
    }
    const prec = PREC[type];
    if (prec === undefined || prec < minPrec) {
      break;
    }

    ts.next(); // Consumes operator
    const op = tokToBinOp(t);
    if (!op) {
      throw new Error(`Unhandled operator token: ${String(t.type)}`);
    }

    const right = parseCondition(ts, prec + 1); // left-assoc
    left = { kind: "binary", op, left, right };
  }

  return left;
}

// parse prefix forms - unary, paren, number, ident
function parsePrefix(ts: TokenStream): Condition {
  const t = ts.peek();
  if (!t) {
    throw new Error("Unexpected EOF in condition");
  }

  if (t.type === "not") {
    ts.next();
    return { kind: "unary", op: "!", expr: parsePrefix(ts) };
  }

  if (t.type === "lparen") {
    ts.next();
    const inner = parseCondition(ts, 0);
    ts.expect("rparen");
    return { kind: "paren", expr: inner };
  }

  if (t.type === "number") {
    ts.next();
    return { kind: "number", value: Number(t.value) };
  }

  if (t.type === "ident") {
    ts.next();
    return { kind: "ident", name: t.value };
  }

  throw new Error(
    `Unexpected token in condition: ${String(t.type)} ${JSON.stringify(t.value)}`,
  );
}
