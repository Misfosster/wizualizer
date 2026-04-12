import type { AplToken, TokenType } from "./lexer";

export class TokenStream {
  private i = 0;
  private tokens: AplToken[];

  constructor(tokens: AplToken[]) {
    this.tokens = tokens;
  }

  peek(offset = 0): AplToken | undefined {
    return this.tokens[this.i + offset];
  }

  next(): AplToken | undefined {
    return this.tokens[this.i++];
  }

  eof(): boolean {
    return this.i >= this.tokens.length;
  }

  position(): number {
    return this.i;
  }

  tokenAt(index: number): AplToken | undefined {
    return this.tokens[index];
  }

  match(type: TokenType, value?: string): AplToken | undefined {
    const t = this.peek();
    if (!t) return;
    if (t.type === type && (value === undefined || t.value === value)) {
      this.i++;
      return t;
    }
  }

  expect(type: TokenType, value?: string): AplToken {
    const t = this.next();
    // console.log(t);
    if (t?.type !== type || (value !== undefined && t.value !== value)) {
      const got = t
        ? `${t.type}(${JSON.stringify(t.value)})`
        : "EOF";
      throw new Error(
        `Expected ${type}${value ? `(${value})` : ""}, got ${got}`,
      );
    }
    return t;
  }
}
