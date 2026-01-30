import type { Token } from "moo";
import lexer from "./lexer";
import type { Action, Condition, BinOp, IdentRef, SeqExpr } from "./types";
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
    // - sequence,spell,spell,spell ...
    // - arbitrary tokens (name=presence_of_mind, use_off_gcd=1, chain=1)
    // WARN:
    // The latter is treated as conditions for now
    // Not sure if we need to change it though?

    // Sequences are spell names seperated by : following a comma
    // We need to check above spell because they are not formatted like usual
    if (spell === "sequence" && ts.peek(0)?.type === "ident") {
      // Don't remove any because the first token is the first spell
      segments.push({ type: "sequence", expr: parseSequence(ts) });
      continue;
    }


    // if=<expr>
    if (
      ts.peek()?.type === "ident" &&
      ts.peek()?.value == "if" &&
      ts.peek(1)?.type === "eq"
    ) {
      ts.next(); // consume ifKw
      ts.next(); // consume eq
      segments.push({ type: "if", expr: parseCondition(ts) });
      continue;
    }

    // target_if=<expr>
    if (
      ts.peek()?.type === "ident" &&
      ts.peek()?.value === "target_if" &&
      ts.peek(1)?.type === "eq"
    ) {
      ts.next(); // consume tifKw
      ts.next(); // consume eq
      segments.push({ type: "target_if", expr: parseCondition(ts) });
      continue;
    }

    // otherwise parse the whole segment as a condition
    const keyTok = ts.expect("ident");
    const key = keyTok.value;
    // console.log(key);

    ts.expect("eq");

    // value as Condition (for now)
    const expr = parseCondition(ts);

    segments.push({ type: "other", key, expr });
  }

  return { category, spell, op, segments };
}

// For precedence in math
const PREC: Record<string, number> = {
  or: 1, // |
  and: 2, // &
  eq: 3,
  eqq: 3,
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
    case "eqq":
      return "==";
    case "slash":
      return "/";
    default:
      return null;
  }
}

// Goes through an identified sequence and stores the idents for all
function parseSequence(ts: TokenStream): SeqExpr {
  const idents: IdentRef[] = [];
  for (; ;) {
    const t = ts.peek(); // Should always be a new ident
    if (!t) {
      break;
    }

    const type = t.type;
    if (type != "ident") {
      throw new Error(`Malformatted sequence: ${String(t.type)}`);
    }

    idents.push({ kind: "ident", name: t.value });
    ts.next(); // Consume token
    // console.log(t.value)

    const sep = ts.peek();
    if (sep?.type === "colon") {
      ts.next(); // consume ':'
      continue; // expect another ident next
    }

    // No colon, seq over
    break;
  }

  if (idents.length === 0) {
    throw new Error("Expected at least one ident in sequence");
  }

  return { kind: "sequence", expr: idents };
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

  if (t.type === "ident") {
    ts.next();
    return { kind: "ident", name: t.value };
  }

  throw new Error(
    `Unexpected token in condition: ${String(t.type)} ${JSON.stringify(t.value)}`,
  );
}
