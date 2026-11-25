export class CalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculatorError";
  }
}

type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "^" }
  | { type: "paren"; value: "(" | ")" }
  | { type: "percent" }
  | { type: "ident"; value: string };

function tokenizeExpression(input: string): Token[] {
  const source = input.replace(/\s+/g, "");
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char >= "0" && char <= "9" || char === ".") {
      let end = index + 1;
      while (end < source.length && (source[end] >= "0" && source[end] <= "9" || source[end] === ".")) end += 1;
      const value = Number(source.slice(index, end));
      if (!Number.isFinite(value)) throw new CalculatorError(`Could not read the number “${source.slice(index, end)}”.`);
      tokens.push({ type: "number", value });
      index = end;
      continue;
    }
    if ("+-*/^".includes(char)) {
      tokens.push({ type: "op", value: char as "+" | "-" | "*" | "/" | "^" });
      index += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }
    if (char === "%") {
      tokens.push({ type: "percent" });
      index += 1;
      continue;
    }
    if (/[a-z]/i.test(char)) {
      let end = index + 1;
      while (end < source.length && /[a-z]/i.test(source[end])) end += 1;
      tokens.push({ type: "ident", value: source.slice(index, end).toLowerCase() });
      index = end;
      continue;
    }
    throw new CalculatorError(`Unsupported character “${char}”.`);
  }
  return tokens;
}

class Parser {
  private cursor = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const value = this.expression();
    if (this.cursor !== this.tokens.length) throw new CalculatorError("Unexpected extra input.");
    if (!Number.isFinite(value)) throw new CalculatorError("The expression did not produce a finite number.");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.cursor];
  }

  private peekOp(operator: "+" | "-" | "*" | "/" | "^"): boolean {
    const token = this.peek();
    return token?.type === "op" && token.value === operator;
  }

  private peekParen(paren: "(" | ")"): boolean {
    const token = this.peek();
    return token?.type === "paren" && token.value === paren;
  }

  private eat(): Token {
    const token = this.tokens[this.cursor];
    if (!token) throw new CalculatorError("The expression ended early.");
    this.cursor += 1;
    return token;
  }

  private expression(): number {
    let value = this.term();
    while (this.peekOp("+") || this.peekOp("-")) {
      const token = this.eat();
      if (token.type !== "op") throw new CalculatorError("Expected an operator.");
      const right = this.term();
      value = token.value === "+" ? value + right : value - right;
    }
    return value;
  }

  private term(): number {
    let value = this.power();
    while (this.peekOp("*") || this.peekOp("/")) {
      const token = this.eat();
      if (token.type !== "op") throw new CalculatorError("Expected an operator.");
      const right = this.power();
      if (token.value === "/" && right === 0) throw new CalculatorError("Division by zero.");
      value = token.value === "*" ? value * right : value / right;
    }
    return value;
  }

  private power(): number {
    const base = this.unary();
    if (this.peekOp("^")) {
      this.eat();
      return base ** this.power();
    }
    return base;
  }

  private unary(): number {
    if (this.peekOp("-")) {
      this.eat();
      return -this.unary();
    }
    if (this.peekOp("+")) {
      this.eat();
      return this.unary();
    }
    return this.primary();
  }

  private primary(): number {
    const token = this.peek();
    if (!token) throw new CalculatorError("Expected a number.");
    if (token.type === "ident") {
      this.eat();
      if (token.value !== "sqrt" && token.value !== "abs") {
        throw new CalculatorError(`Unknown function “${token.value}”. Use sqrt or abs.`);
      }
      if (!this.peekParen("(")) {
        throw new CalculatorError(`${token.value} needs parentheses.`);
      }
      this.eat();
      const argument = this.expression();
      if (!this.peekParen(")")) throw new CalculatorError("Missing closing parenthesis.");
      this.eat();
      if (token.value === "sqrt") {
        if (argument < 0) throw new CalculatorError("Cannot take the square root of a negative number.");
        return Math.sqrt(argument);
      }
      return Math.abs(argument);
    }
    if (token.type === "number") {
      this.eat();
      return this.percent(token.value);
    }
    if (token.type === "paren" && token.value === "(") {
      this.eat();
      const value = this.expression();
      if (!this.peekParen(")")) throw new CalculatorError("Missing closing parenthesis.");
      this.eat();
      return this.percent(value);
    }
    throw new CalculatorError("Expected a number, parentheses, or a function.");
  }

  private percent(value: number): number {
    if (this.peek()?.type === "percent") {
      this.eat();
      return value / 100;
    }
    return value;
  }
}

export function evaluateExpression(expression: string): number {
  const trimmed = expression.trim().replace(/[?=]+$/g, "").trim();
  if (!trimmed) throw new CalculatorError("Write an expression to calculate.");
  return new Parser(tokenizeExpression(trimmed)).parse();
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "undefined";
  if (Object.is(value, -0)) return "0";
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

export function extractExpression(query: string): string | null {
  const trimmed = query.trim().replace(/[?.!]+$/g, "");
  const stripped = trimmed.replace(/^(please\s+)?(calculate|compute|evaluate|what is|what's|whats)\s+/i, "").trim();
  const candidate = stripped.replace(/(\d)\s*x\s*(\d)/gi, "$1*$2");
  if (!candidate) return null;
  if (!/^[\d\s+\-*/^().,%a-z]+$/i.test(candidate)) return null;
  if (!/\d/.test(candidate)) return null;
  const words = candidate.match(/[a-z]+/gi) ?? [];
  if (words.some((word) => word.toLowerCase() !== "sqrt" && word.toLowerCase() !== "abs")) return null;
  return candidate;
}
