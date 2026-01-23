import type { Token } from "moo";
import lexer from "./lexer";
import type { Action, Condition, BinOp } from "./types";
import { TokenStream } from "./token-stream";

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

export function parseAction(line: string): Action | null {
  const tokens = tokenizeLine(line);

  // Empty or comments are not needed to parse
  if (tokens.length === 0 || tokens[0]?.type === "comment") {
    return null;
  }

  const ts = new TokenStream(tokens);
  const category = ts.expect("ident").value;

  const op: Action["op"] = ts.match("eq")
    ? "="
    : ts.match("plusEqSlash")
      ? "+="
      : (() => {
        throw new Error("Expected '=' or '+=/' after category");
      })();

  // Incase of uncaught slash (this fixes a bug)
  ts.match("slash");
  const spell = ts.expect("ident").value;

  const segments: Action["segments"] = [];

  while (ts.match("comma")) {
    // segment can be:
    // - if=<expr>
    // - target_if=<expr>
    // - arbitrary tokens (name=presence_of_mind, use_off_gcd=1, chain=1)
    // WARN:
    // The latter is treated as conditions for now
    // Not sure if we need to change it though?

    // if=<expr>
    if (ts.peek()?.type === "ifKw" && ts.peek(1)?.type === "eq") {
      ts.next(); // consume ifKw
      ts.next(); // consume eq
      segments.push({ kind: "if", expr: parseCondition(ts) });
      continue;
    }

    // target_if=<expr>
    if (ts.peek()?.type === "tifKw" && ts.peek(1)?.type === "eq") {
      ts.next(); // consume tifKw
      ts.next(); // consume eq
      segments.push({ kind: "target_if", expr: parseCondition(ts) });
      continue;
    }

    // otherwise parse the whole segment as a condition
    const keyTok = ts.expect("ident");
    const key = keyTok.value;

    ts.expect("eq");

    // value as Condition (for now)
    const expr = parseCondition(ts);

    segments.push({ kind: "arg", key, expr });
  }

  return { category, spell, op, segments };
}

// For precedence in math
const PREC: Record<string, number> = {
  or: 1, // |
  and: 2, // &
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

  if (t.type === "ident" || t.type === "ifKw") {
    ts.next();
    return { kind: "ident", name: t.value };
  }

  throw new Error(
    `Unexpected token in condition: ${String(t.type)} ${JSON.stringify(t.value)}`,
  );
}
