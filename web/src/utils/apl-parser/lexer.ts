import moo from "moo";

const lexer = moo.compile({
  ws: { match: /[ \t]+/, lineBreaks: false },
  nl: { match: /\r?\n/, lineBreaks: true },
  comment: /#[^\n]*/,

  // operators / punctuation
  plusEqSlash: "+=/",
  plusEq: "+=",
  eq: "=",
  comma: ",",
  plus: "+",
  minus: "-",
  mult: "*",
  slash: "/",
  lparen: "(",
  rparen: ")",

  // boolean / logic operators used in `if=...`
  and: "&",
  or: "|",
  not: "!",

  // comparisons
  le: "<=",
  ge: ">=",
  lt: "<",
  gt: ">",

  // Keywords
  // ifKw: "if",
  // tifKw: "target_if",

  // literals
  number: /[0-9]+(?:\.[0-9]+)?/,
  ident: {
    match: /[A-Za-z_][A-Za-z0-9_.\-]*/,
    type: moo.keywords({
      ifKw: "if",
      tifKw: "target_if",
    }),
  },
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
