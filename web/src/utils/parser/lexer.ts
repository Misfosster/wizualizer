import moo from "moo";

const lexer = moo.compile({
  ws: { match: /[ \t]+/, lineBreaks: false },
  nl: { match: /\r?\n/, lineBreaks: true },
  comment: /#[^\n]*/,

  // operators / punctuation
  plusEq: "+=",
  eq: "=",
  comma: ",",
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
  ident: /[A-Za-z_][A-Za-z0-9_.]*/, // buff.hot_streak.up
});

lexer.reset(
  `actions.ff_combustion=combustion,use_off_gcd=1,use_while_casting=1,if=buff.combustion.down&action.fireball.executing&(action.fireball.execute_remains<variable.cast_remains_time)|action.meteor.in_flight&(action.meteor.in_flight_remains<variable.cast_remains_time)|action.pyroblast.executing&(action.pyroblast.execute_remains<variable.cast_remains_time)|action.scorch.executing&(action.scorch.execute_remains<variable.cast_remains_time)`,
);

for (const tok of lexer) {
  if (tok.type === "ws") {
    continue;
  }
  console.log(
    `${String(tok.line)}:${String(tok.col)}  ${String(tok.type)}  ${tok.value}`,
  );
}
