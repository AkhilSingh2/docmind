function decodePdfString(inner: string): string {
  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

export function extractPdfLiterals(buffer: Buffer): string {
  const source = buffer.toString("latin1");
  const pieces: string[] = [];
  const pattern = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  for (const match of source.matchAll(pattern)) {
    const decoded = decodePdfString(match[1]).trim();
    if (decoded) pieces.push(decoded);
  }
  return pieces.join(" ").replace(/[ \t]{2,}/g, " ").trim();
}

export async function extractPdf(buffer: Buffer): Promise<{ text: string; pages: string[] }> {
  try {
    const { extractText } = await import("unpdf");
    const extracted = await extractText(new Uint8Array(buffer), { mergePages: false });
    const pages = extracted.text.map((page) => page.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (pages.length) {
      const text = pages.map((page, index) => `## Page ${index + 1}\n${page}`).join("\n\n");
      return { text, pages };
    }
  } catch {
    // Simple text PDFs still yield their literal strings below.
  }
  const literal = extractPdfLiterals(buffer);
  if (!literal) {
    throw new Error("Could not read text from that PDF. Export it as text or markdown and upload that instead.");
  }
  return { text: `## Page 1\n${literal}`, pages: [literal] };
}
