import type { Token } from "moo";

export class TokenStream {
  private i = 0;
  private tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  peek(offset = 0): Token | undefined {
    return this.tokens[this.i + offset];
  }

  next(): Token | undefined {
    return this.tokens[this.i++];
  }

  eof(): boolean {
    return this.i >= this.tokens.length;
  }

  match(type: string, value?: string): Token | undefined {
    const t = this.peek();
    if (!t) return;
    if (t.type === type && (value === undefined || t.value === value)) {
      this.i++;
      return t;
    }
  }

  expect(type: string, value?: string): Token {
    const t = this.next();
    // console.log(t);
    if (t?.type !== type || (value !== undefined && t.value !== value)) {
      const got = t
        ? `${t.type ?? "UNKNOWN"}(${JSON.stringify(t.value)})`
        : "EOF";
      throw new Error(
        `Expected ${type}${value ? `(${value})` : ""}, got ${got}`,
      );
    }
    return t;
  }
}
