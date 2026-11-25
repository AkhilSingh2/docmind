import { chunkText } from "@/lib/rag/chunk";
import { embedMany } from "@/lib/rag/embed";
import { preview } from "@/lib/rag/text";
import { SEED_DOCUMENTS } from "@/lib/corpus/documents";
import type { VectorStore } from "@/lib/store/types";
import type { DocumentRecord, DocumentSummary, SourceType } from "@/lib/types";

const MAX_CHUNKS = 80;

export function summariseDocument(document: DocumentRecord, chunkCount: number): DocumentSummary {
  return {
    id: document.id,
    title: document.title,
    sourceType: document.sourceType,
    sourceLabel: document.sourceLabel,
    createdAt: document.createdAt,
    seeded: document.seeded,
    chunkCount,
    preview: preview(document.text),
  };
}

export async function addDocument(
  store: VectorStore,
  input: {
    id?: string;
    title: string;
    sourceType: SourceType;
    sourceLabel: string;
    text: string;
    seeded?: boolean;
  },
): Promise<DocumentSummary> {
  const text = input.text.replace(/\u0000/g, "").trim();
  if (text.length < 20) throw new Error("That document is too short to index.");
  if (text.length > 200_000) throw new Error("That document is longer than 200,000 characters.");
  const title = input.title.trim() || "Untitled note";
  const id = input.id ?? `doc_${crypto.randomUUID().slice(0, 8)}`;
  const drafts = chunkText(text).slice(0, MAX_CHUNKS);
  if (!drafts.length) throw new Error("Nothing indexable was found in that document.");
  const embeddings = await embedMany(
    drafts.map((draft) => (draft.heading ? `${draft.heading}\n${draft.content}` : draft.content)),
  );
  const document: DocumentRecord = {
    id,
    title,
    sourceType: input.sourceType,
    sourceLabel: input.sourceLabel,
    text,
    createdAt: new Date().toISOString(),
    seeded: Boolean(input.seeded),
  };
  await store.upsertDocument(
    document,
    drafts.map((draft, index) => ({
      id: `${id}-c${draft.ordinal}`,
      documentId: id,
      ordinal: draft.ordinal,
      heading: draft.heading,
      content: draft.content,
      embedding: embeddings[index],
    })),
  );
  return summariseDocument(document, drafts.length);
}

export async function ensureSeed(store: VectorStore): Promise<void> {
  const existing = new Set((await store.listDocuments()).map((document) => document.id));
  for (const seed of SEED_DOCUMENTS) {
    if (existing.has(seed.id)) continue;
    await addDocument(store, {
      id: seed.id,
      title: seed.title,
      sourceType: "seed",
      sourceLabel: "Sample library",
      text: seed.text,
      seeded: true,
    });
  }
}

export async function listSummaries(store: VectorStore): Promise<DocumentSummary[]> {
  const documents = await store.listDocuments();
  const summaries: DocumentSummary[] = [];
  for (const document of documents) {
    const full = await store.getDocument(document.id);
    summaries.push(summariseDocument(document, full?.chunks.length ?? 0));
  }
  return summaries;
}

export function titleFromMarkdown(text: string, fallback: string): string {
  const heading = text.match(/^\s*#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}
