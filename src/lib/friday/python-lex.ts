/**
 * Minimal, non-executing Python lexical helpers. FRIDAY never runs uploaded
 * code: these utilities only read text to build logical lines and to mask
 * string literals so identifiers inside strings are not mistaken for code.
 */

export interface LogicalLine {
  text: string;
  line: number; // 1-based start line
  endLine: number;
  indent: number;
}

const STR_PREFIX = /[rRbBuUfF]{1,2}$/;

/** Join physical lines into logical lines (parens, backslashes, triple quotes) and drop comments. */
export function toLogicalLines(src: string): { lines: LogicalLine[]; warnings: string[] } {
  const warnings: string[] = [];
  const out: LogicalLine[] = [];
  let buf = "";
  let startLine = 1;
  let line = 1;
  let depth = 0;
  let i = 0;
  let quote: string | null = null; // ' " ''' """
  let atLineStart = true;
  let indent = 0;
  let indentCounting = true;
  const n = src.length;

  const flush = () => {
    const t = buf.trim();
    if (t.length) out.push({ text: t, line: startLine, endLine: line, indent });
    buf = "";
  };

  while (i < n) {
    const c = src[i];
    if (atLineStart && !quote && depth === 0) {
      // new logical line begins
      atLineStart = false;
      indent = 0;
      indentCounting = true;
      startLine = line;
    }
    if (indentCounting && !quote && depth === 0 && buf.trim() === "") {
      if (c === " ") { indent += 1; i++; continue; }
      if (c === "\t") { indent += 4; i++; continue; }
      indentCounting = false;
    }

    if (quote) {
      if (c === "\\") { buf += c + (src[i + 1] ?? ""); if (src[i + 1] === "\n") line++; i += 2; continue; }
      if (src.startsWith(quote, i)) { buf += quote; i += quote.length; quote = null; continue; }
      if (c === "\n") {
        if (quote.length === 1) { warnings.push(`Unterminated string near line ${line}`); quote = null; }
        else { buf += " "; line++; i++; continue; }
      } else { buf += c; i++; continue; }
    }

    if (c === "#") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const triple = src.startsWith(c.repeat(3), i);
      quote = triple ? c.repeat(3) : c;
      buf += quote;
      i += quote.length;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
    if (c === "\\" && src[i + 1] === "\n") { buf += " "; i += 2; line++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") {
      line++;
      i++;
      if (depth > 0) { buf += " "; continue; }
      flush();
      atLineStart = true;
      continue;
    }
    buf += c;
    i++;
  }
  if (quote) warnings.push("File ends inside an unterminated string literal");
  if (depth > 0) warnings.push("File ends with unbalanced brackets");
  line = Math.max(line, startLine);
  flush();
  return { lines: out, warnings };
}

/**
 * Return a same-length copy of `s` where plain string literal contents are
 * blanked with spaces. f-string `{...}` expressions are preserved.
 */
export function codeOnly(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'") {
      const prefix = (out.match(STR_PREFIX)?.[0] ?? "").toLowerCase();
      const isF = prefix.includes("f");
      const q = s.startsWith(c.repeat(3), i) ? c.repeat(3) : c;
      out += q;
      i += q.length;
      let brace = 0;
      while (i < s.length && !s.startsWith(q, i)) {
        const ch = s[i];
        if (ch === "\\") { out += "  ".slice(0, Math.min(2, s.length - i)); i += 2; continue; }
        if (isF) {
          if (ch === "{" && s[i + 1] === "{" && brace === 0) { out += "  "; i += 2; continue; }
          if (ch === "{") { brace++; out += ch; i++; continue; }
          if (ch === "}" && brace > 0) { brace--; out += ch; i++; continue; }
          out += brace > 0 ? ch : " ";
        } else out += " ";
        i++;
      }
      if (i < s.length) { out += q; i += q.length; }
      continue;
    }
    out += c;
    i++;
  }
  return out.slice(0, s.length);
}

/** Given index of '(' in s (masked & original same length), return inner text and end index. */
export function matchParen(masked: string, open: number): number {
  let d = 0;
  for (let i = open; i < masked.length; i++) {
    const c = masked[i];
    if (c === "(" || c === "[" || c === "{") d++;
    else if (c === ")" || c === "]" || c === "}") { d--; if (d === 0) return i; }
  }
  return masked.length;
}

/** Split at top-level commas. Uses masked text for structure, returns original slices. */
export function splitArgs(orig: string, masked: string): string[] {
  const parts: string[] = [];
  let d = 0;
  let last = 0;
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i];
    if (c === "(" || c === "[" || c === "{") d++;
    else if (c === ")" || c === "]" || c === "}") d--;
    else if (c === "," && d === 0) { parts.push(orig.slice(last, i)); last = i + 1; }
  }
  const tail = orig.slice(last);
  if (tail.trim().length) parts.push(tail);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function hashString(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 + c, 2246822519) ^ (h2 >>> 13);
  }
  return ((h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0")).slice(0, 14);
}
