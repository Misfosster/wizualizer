export type SegmentType = "if" | "target_if" | "sequence";

export type Segment = SegmentBase | SegmentKeyed;

export interface SegmentBase {
  type: SegmentType;
  expr: Condition;
}

export interface SegmentKeyed {
  type: "other";
  key: string; // For segments that are for example abc.gcd_remains=abc, that cannot be predicted
  expr: Condition;
}

export interface Action {
  category: string;
  spell: string;
  op: "=" | "+=";
  segments: Segment[];
}

export type Condition =
  | IdentRef
  | ParenExpr
  | UnaryExpr
  | BinExpr
  | SeqExpr
  | Num;

// Just one ident (buff.time_warp or something)
export interface IdentRef {
  kind: "ident";
  name: string;
}

// Grouping, (a | (b < c)) etc
export interface ParenExpr {
  kind: "paren";
  expr: Condition;
}

// Negation (!buff.time_warp)
export interface UnaryExpr {
  kind: "unary";
  op: UnaryOp; // not
  expr: Condition;
}

// buff.time_warp & buff.idk
export interface BinExpr {
  kind: "binary";
  op: BinOp;
  left: Condition;
  right: Condition;
}

export interface SeqExpr {
  kind: "sequence";
  expr: IdentRef[];
}

export interface Num {
  kind: "number";
  value: number;
}

// TODO: Maybe change to use words, such as "and" or "else" or "not" etc?
export type BoolOp = "&" | "|" | "^" | "<" | "<=" | ">" | ">=" | "=" | "!=" | "==" | "<?" | ">?" | "~" | "!~";
export type UnaryOp = "!" | "@";
export type AritOp = "+" | "-" | "*" | "/" | "%" | "%%";
export type BinOp = BoolOp | AritOp | UnaryOp;
