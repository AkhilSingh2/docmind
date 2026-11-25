const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are", "was",
  "were", "be", "been", "this", "that", "it", "as", "by", "from", "at", "your", "you", "we",
  "our", "their", "its", "if", "but", "not", "can", "how", "what", "when", "why", "which",
  "into", "about", "than", "then", "them", "they", "do", "does", "did", "so", "just",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.#]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP.has(token));
}

export function bodySentences(content: string, heading: string | null): string[] {
  const body = heading && content.startsWith(`${heading}\n`) ? content.slice(heading.length).trim() : content;
  const found = sentences(body);
  return found.length ? found : sentences(content);
}

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 40);
}

export function preview(text: string, length = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= length) return flat;
  return `${flat.slice(0, length).trimEnd()}…`;
}

export function formatScore(score: number): string {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}
