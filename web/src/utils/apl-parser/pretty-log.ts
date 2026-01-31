import type { Action, Segment, Condition, BinExpr, IdentRef } from "./types";

export function prettyAction(a: Action): string {
  let op = "";
  if (a.op === "+=") {
    op = "+=/";
  } else {
    op = "=";
  }
  const base = `${a.category}${op}${a.spell}`;
  if (a.segments.length === 0) return base;

  return base + "," + a.segments.map(prettySegment).join(",");
}

export function prettySegment(s: Segment): string {
  switch (s.type) {
    case "if":
      return `if=${prettyCond(s.expr)}`;
    case "target_if":
      return `target_if=${prettyCond(s.expr)}`;
    case "sequence":
      return prettyCond(s.expr); // NOTE: No need to print sequence= because that is handeled by pretty action
    case "other":
      // NOTE: Only other has key, this is general catchall
      return `${s.key}=${prettyCond(s.expr)}`;
    default:
      return "\n!!!ERROR IN PRINT!!!\n";
  }
}

export function prettyCond(c: Condition): string {
  switch (c.kind) {
    case "ident":
      return c.name;
    case "sequence":
      return prettySequence(c.expr);
    case "number":
      return String(c.value);
    case "paren":
      return `(${prettyCond(c.expr)})`;
    case "unary":
      return `!${c.expr.kind === "binary" ? `(${prettyCond(c.expr)})` : prettyCond(c.expr)}`;
    case "binary":
      return prettyBinary(c);
  }
}

function prec(op: string): number {
  switch (op) {
    // parser: and/xor/or same precedence => printer must treat them equal
    case "|":
    case "^":
    case "&":
      return 1;

    case "=":
    case "!=":
    case "==":
    case "<":
    case "<=":
    case ">":
    case ">=":
    case "~":
    case "!~":
      return 2;

    case "<?":
    case ">?":
      return 3;

    case "+":
    case "-":
      return 4;

    case "*":
    case "/":
    case "%":
    case "%%":
      return 5;

    default:
      return 0;
  }
}

function prettyBinary(b: BinExpr): string {
  const l = wrap(b.left, b.op);
  const r = wrap(b.right, b.op);
  return `${l}${b.op}${r}`;
}

function prettySequence(e: IdentRef[]): string {
  let str = "";
  for (let i = 0; i < e.length; i++) {
    str += e[i].name;
    if (i != e.length - 1) {
      str += ":";
    }
  }
  return str;
}

function wrap(child: Condition, parentOp: string): string {
  if (child.kind !== "binary") return prettyCond(child);
  return prec(child.op) < prec(parentOp)
    ? `(${prettyCond(child)})`
    : prettyCond(child);
}
