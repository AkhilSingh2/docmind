import { extractExpression } from "@/lib/tools/calculator";

export type Intent =
  | { type: "calculate"; expression: string }
  | { type: "compare"; left: string; right: string }
  | { type: "summarise"; subject: string }
  | { type: "web"; query: string }
  | { type: "retrieve"; query: string };

export function routeIntent(query: string): Intent {
  const trimmed = query.trim();
  const expression = extractExpression(trimmed);
  if (expression && /^(please\s+)?(calculate|compute|evaluate|what is|what's|whats)\b/i.test(trimmed)) {
    return { type: "calculate", expression };
  }
  if (expression && /^[\d\s(]/.test(trimmed) && /[+\-*/^%]/.test(trimmed)) {
    return { type: "calculate", expression };
  }

  if (/\b(search the web|look (it )?up online|on the web|duckduckgo|from the internet)\b/i.test(trimmed)) {
    return { type: "web", query: trimmed.replace(/\b(search the web for|search the web|look it up online|look up online)\b/i, "").trim() || trimmed };
  }

  const comparison = /^(?:please\s+)?(?:compare|contrast)\s+(.+?)\s+(?:with|and|versus|vs\.?|to)\s+(.+)$/i.exec(trimmed.replace(/[?.!]+$/, ""));
  if (comparison) {
    return { type: "compare", left: comparison[1].trim(), right: comparison[2].trim() };
  }
  if (/\b(compare|versus|vs\.?|difference between)\b/i.test(trimmed)) {
    const between = /difference between\s+(.+?)\s+and\s+(.+)/i.exec(trimmed);
    if (between) return { type: "compare", left: between[1].trim(), right: between[2].trim() };
    return { type: "compare", left: trimmed, right: trimmed };
  }

  if (/\bsummar(?:ise|ize|y)\b/i.test(trimmed)) {
    const subject = trimmed
      .replace(/^(please\s+)?summar(?:ise|ize|y)\s+/i, "")
      .replace(/\b(the|document|doc|notes|note)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { type: "summarise", subject: subject || trimmed };
  }

  return { type: "retrieve", query: trimmed };
}
