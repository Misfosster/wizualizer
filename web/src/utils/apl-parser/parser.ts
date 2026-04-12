import lexer, { type AplToken, type TokenType, toAplToken } from "./lexer";
import type {
  Action,
  BinOp,
  CallName,
  CallExpr,
  Condition,
  IdentRef,
  SeqExpr,
  UnaryOp,
} from "./types";
import { TokenStream } from "./token-stream";

function isCallName(name: string): name is CallName {
  switch (name) {
    case "floor":
    case "ceil":
      return true;
    default:
      return false;
  }
}

function tokenizeLine(line: string): AplToken[] {
  lexer.reset(line);
  const tokens: AplToken[] = [];
  for (const t of lexer) {
    const token = toAplToken(t);
    if (token.type === "ws") {
      continue;
    }

    tokens.push(token);
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
      const expr = parseSequence(ts);
      expectSegmentBoundary(ts);
      segments.push({ type: "sequence", expr });
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
      segments.push({ type: "if", expr: parseSegmentCondition(ts) });
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
      segments.push({ type: "target_if", expr: parseSegmentCondition(ts) });
      continue;
    }

    // otherwise parse the whole segment as a condition
    const keyTok = ts.expect("ident");
    const key = keyTok.value;
    // console.log(key);

    ts.expect("eq");

    // value as Condition (for now)
    const expr = parseSegmentCondition(ts);

    segments.push({ type: "other", key, expr });
  }

  if (!ts.eof()) {
    const t = ts.peek();
    throw new Error(
      `Unexpected trailing token: ${String(t?.type)} ${JSON.stringify(t?.value)}`,
    );
  }

  return { category, spell, op, segments };
}

// Convert "low is tight" -> "high is tight" for Pratt
function bp(tokType: TokenType): number | undefined {
  const p = PREC[tokType];
  if (p === undefined) return undefined;
  return 100 - p;
}

// For precedence (https://github.com/simulationcraft/simc/wiki/Action-List-Conditional-Expressions)
const PREC: Partial<Record<TokenType, number>> = {
  mult: 3,
  div: 3,
  mod: 3,
  plus: 4,
  minus: 4,
  max: 5,
  min: 5,
  eq: 6,
  eqq: 6,
  neq: 6,
  lt: 6,
  le: 6,
  gt: 6,
  ge: 6,
  tilde: 6,
  nottilde: 6,
  and: 7,
  xor: 8,
  or: 8,
};

function tokToBinOp(t: AplToken): BinOp | null {
  switch (t.type) {
    case "div":
      return "%";
    case "mod":
      return "%%";
    case "max":
      return "<?";
    case "min":
      return ">?";
    case "or":
      return "|";
    case "and":
      return "&";
    case "xor":
      return "^";
    case "eq":
      return "=";
    case "neq":
      return "!=";
    case "lt":
      return "<";
    case "gt":
      return ">";
    case "le":
      return "<=";
    case "ge":
      return ">=";
    case "tilde":
      return "~";
    case "nottilde":
      return "!~";
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

function tokToUnaryOp(t: AplToken): UnaryOp | null {
  switch (t.type) {
    case "not":
      return "!";
    case "at":
      return "@";
    case "plus":
      return "+";
    case "minus":
      return "-";
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
      throw new Error(`Malformatted sequence: ${t.type}`);
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
    const prec = bp(type);
    if (prec === undefined || prec < minPrec) {
      break;
    }

    ts.next(); // Consumes operator
    const op = tokToBinOp(t);
    if (!op) {
      throw new Error(`Unhandled operator token: ${t.type}`);
    }

    const right = parseCondition(ts, prec + 1); // left-assoc
    left = { kind: "binary", op, left, right };
  }

  return left;
}

function parseSegmentCondition(ts: TokenStream): Condition {
  const expr = parseCondition(ts);
  expectSegmentBoundary(ts);
  return expr;
}

function expectSegmentBoundary(ts: TokenStream): void {
  const t = ts.peek();
  if (!t || t.type === "comma") {
    return;
  }

  throw new Error(
    `Unexpected token after segment expression: ${t.type} ${JSON.stringify(t.value)}`,
  );
}

function parsePrefix(ts: TokenStream): Condition {
  const t = ts.peek();
  if (!t) {
    throw new Error("Unexpected EOF in condition");
  }

  const op = tokToUnaryOp(t);
  if (op) {
    ts.next();
    return { kind: "unary", op, expr: parsePrefix(ts) };
  }

  return parsePrimary(ts);
}

function parsePrimary(ts: TokenStream): Condition {
  const t = ts.peek();
  if (!t) {
    throw new Error("Unexpected EOF in condition");
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
    const name = t.value;

    if (ts.match("lparen")) {
      return parseCall(ts, name);
    }

    return { kind: "ident", name };
  }

  throw new Error(
    `Unexpected token in condition: ${t.type} ${JSON.stringify(t.value)}`,
  );
}

function parseCall(ts: TokenStream, name: string): CallExpr {
  if (!isCallName(name)) {
    throw new Error(`Unsupported function call: ${name}`);
  }

  if (ts.peek()?.type === "rparen") {
    throw new Error(`Function '${name}' expects exactly one argument`);
  }

  const arg = parseCondition(ts);
  if (ts.match("comma")) {
    throw new Error(`Function '${name}' only supports a single argument`);
  }

  ts.expect("rparen");

  return { kind: "call", name, args: [arg] };
}
