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

  // literals
  number: /[0-9]+(?:\.[0-9]+)?/,
  ident: /[A-Za-z_][A-Za-z0-9_.]*/,
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
