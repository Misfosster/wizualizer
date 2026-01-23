export type SegmentParsed =
  | { kind: "arg"; key: string; valueRaw: string }
  | { kind: "positional"; valueRaw: string };

export interface ActionParsed {
  category: string;
  spell: string;
  op: "=" | "+=";
  segments: SegmentParsed[];
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

export type OptionKind = "expr" | "string" | "number" | "enum" | "list";

export interface OptionSchema {
  kind: OptionKind;
  required?: boolean;
  allowed?: string[];
  delimiter?: string;
  itemKind?: "string" | "number";
}

export interface ActionSchema {
  options?: Record<string, OptionSchema>;
  positional?: OptionSchema;
}

export interface Schema {
  actions?: Record<string, ActionSchema>;
  defaults?: ActionSchema;
}

export type ListItem = string | number;

export type ParsedValue =
  | { kind: "expr"; expr: Condition }
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "enum"; value: string }
  | { kind: "list"; items: ListItem[] }
  | { kind: "raw"; value: string };

export type SegmentInterpreted =
  | { kind: "arg"; key: string; value: ParsedValue; valueRaw: string }
  | { kind: "positional"; value: ParsedValue; valueRaw: string };

export interface Diagnostic {
  level: "error" | "warning";
  message: string;
  segmentIndex?: number;
  key?: string;
}

export interface ActionInterpreted {
  category: string;
  spell: string;
  op: "=" | "+=";
  segments: SegmentInterpreted[];
  diagnostics: Diagnostic[];
}

// TODO: Maybe change to use words, such as "and" or "else" or "not" etc?
export type BoolOp = "&" | "|" | "<" | "<=" | ">" | ">=" | "=";
export type UnaryOp = "!";
export type AritOp = "+" | "-" | "*" | "/";
export type BinOp = BoolOp | AritOp;
