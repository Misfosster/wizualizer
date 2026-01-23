export type Segment =
  | { kind: "arg"; key: string; expr: Condition }
  | { kind: "positional"; expr: Condition };

export interface Action {
  category: string;
  spell: string;
  op: "=" | "+=";
  segments: Segment[];
}

export type Condition = IdentRef | ParenExpr | UnaryExpr | BinExpr | Num;

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

export interface Num {
  kind: "number";
  value: number;
}

// TODO: Maybe change to use words, such as "and" or "else" or "not" etc?
export type BoolOp = "&" | "|" | "<" | "<=" | ">" | ">=" | "=";
export type UnaryOp = "!";
export type AritOp = "+" | "-" | "*" | "/";
export type BinOp = BoolOp | AritOp;
