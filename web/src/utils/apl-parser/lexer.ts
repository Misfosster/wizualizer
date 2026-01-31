import moo from "moo";

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
  number: /[0-9]+(?:\.[0-9]+)?/,
  ident: /[A-Za-z_][A-Za-z0-9_.\-]*/,
});

for (const tok of lexer) {
  if (tok.type === "ws") {
    continue;
  }
  console.log(
    `${String(tok.line)}:${String(tok.col)}  ${String(tok.type)}  ${tok.value}`,
  );
}

export default lexer;
