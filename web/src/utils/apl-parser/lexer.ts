import moo, { type Token } from "moo";

const TOKEN_TYPES = [
  "ws",
  "nl",
  "comment",
  "plusEqSlash",
  "plusEq",
  "neq",
  "eqq",
  "nottilde",
  "eq",
  "comma",
  "plus",
  "colon",
  "minus",
  "mult",
  "slash",
  "lparen",
  "rparen",
  "tilde",
  "at",
  "mod",
  "div",
  "xor",
  "and",
  "or",
  "not",
  "max",
  "min",
  "le",
  "ge",
  "lt",
  "gt",
  "number",
  "ident",
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];

export type AplToken = Omit<Token, "type" | "value"> & {
  type: TokenType;
  value: string;
};

const TOKEN_TYPE_SET: ReadonlySet<string> = new Set(TOKEN_TYPES);

function isTokenType(type: string | undefined): type is TokenType {
  return type !== undefined && TOKEN_TYPE_SET.has(type);
}

export function toAplToken(t: Token): AplToken {
  if (!isTokenType(t.type)) {
    throw new Error(`Unexpected token type: ${String(t.type)}`);
  }

  if (typeof t.value !== "string") {
    throw new Error(`Expected token value to be a string, got ${typeof t.value}`);
  }

  return {
    ...t,
    type: t.type,
    value: t.value,
  };
}

const lexer = moo.compile({
  ws: { match: /[ \t]+/, lineBreaks: false },
  nl: { match: /\r?\n/, lineBreaks: true },
  comment: /#[^\n]*/,

  // operators / punctuation
  plusEqSlash: "+=/",
  plusEq: "+=",
  neq: "!=", // NEW
  eqq: "==", // Equiv to eq, used in some APLs for some reason, not documented
  nottilde: "!~", // NEW
  eq: "=",
  comma: ",",
  plus: "+",
  colon: ":",
  minus: "-",
  mult: "*",
  slash: "/",
  lparen: "(",
  rparen: ")",

  tilde: "~", // NEW
  at: "@", // NEW

  // boolean / logic operators used in `if=...`
  mod: "%%", // NEW
  div: "%", // NEW
  xor: "^", // NEW
  and: "&",
  or: "|",
  not: "!",

  // comparisons
  max: "<?", // NEW
  min: ">?", // NEW
  le: "<=",
  ge: ">=",
  lt: "<",
  gt: ">",

  // literals
  ident: /(?:[A-Za-z_][A-Za-z0-9_.\-]*|[0-9]+[A-Za-z_][A-Za-z0-9_.\-]*)/,
  number: /[0-9]+(?:\.[0-9]+)?(?![A-Za-z_])/,
});

export default lexer;
