import type { ActionParsed, SegmentParsed, Condition, BinExpr } from "./types";

export function prettyAction(a: ActionParsed): string {
  const base = `${a.category}${a.op}${a.spell}`;
  if (a.segments.length === 0) return base;

  return base + "," + a.segments.map(prettySegment).join(",");
}

export function prettySegment(s: SegmentParsed): string {
  switch (s.kind) {
    case "arg":
      return `${s.key}=${s.valueRaw}`;
    case "positional":
      return s.valueRaw;
  }
}

export function prettyCond(c: Condition): string {
  switch (c.kind) {
    case "ident":
      return c.name;
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
    case "|":
      return 1;
    case "&":
      return 2;
    case "=":
    case "<":
    case "<=":
    case ">":
    case ">=":
      return 3;
    default:
      return 0;
  }
}

function prettyBinary(b: BinExpr): string {
  const l = wrap(b.left, b.op);
  const r = wrap(b.right, b.op);
  return `${l}${b.op}${r}`;
}

function wrap(child: Condition, parentOp: string): string {
  if (child.kind !== "binary") return prettyCond(child);
  return prec(child.op) < prec(parentOp)
    ? `(${prettyCond(child)})`
    : prettyCond(child);
}
