export const DEFAULT_CHUNK_SIZE = 900;
export const DEFAULT_CHUNK_OVERLAP = 140;

export type ChunkDraft = {
  ordinal: number;
  heading: string | null;
  content: string;
};

export type ChunkOptions = {
  size?: number;
  overlap?: number;
};

type Section = { heading: string | null; body: string };

export function splitSections(text: string): Section[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: Section[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    buffer = [];
    if (body) sections.push({ heading, body });
  };

  for (const line of lines) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (match) {
      flush();
      heading = match[2].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (!sections.length && text.trim()) {
    sections.push({ heading: null, body: text.trim() });
  }
  return sections;
}

export function windowText(body: string, size = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP): string[] {
  const clean = body.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const parts: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size);
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const paragraph = slice.lastIndexOf("\n\n");
      const sentence = slice.lastIndexOf(". ");
      if (paragraph > size * 0.45) end = start + paragraph;
      else if (sentence > size * 0.45) end = start + sentence + 1;
    }

    let piece = clean.slice(start, end).trim();
    if (piece.length < 80 && end < clean.length) {
      end = Math.min(clean.length, start + size);
      piece = clean.slice(start, end).trim();
    }
    if (piece) parts.push(piece);
    if (end >= clean.length) break;
    const next = Math.max(start + 1, end - overlap);
    start = next;
  }
  return parts;
}

export function chunkText(text: string, options: ChunkOptions = {}): ChunkDraft[] {
  const size = options.size ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_CHUNK_OVERLAP;
  const drafts: ChunkDraft[] = [];
  let ordinal = 0;

  for (const section of splitSections(text)) {
    for (const body of windowText(section.body, size, overlap)) {
      drafts.push({ ordinal: ordinal++, heading: section.heading, content: body });
    }
  }
  return drafts;
}
