import { embedText } from "@/lib/rag/embed";
import { rankChunks } from "@/lib/rag/rank";
import type { StoredDocument, VectorStore } from "@/lib/store/types";
import type { ChunkRecord, DocumentRecord, SearchHit } from "@/lib/types";

/** In-browser store for the static demo. Same behaviour as the local JSON store, kept in memory. */
export class MemoryVectorStore implements VectorStore {
  kind = "local" as const;
  private documents: DocumentRecord[] = [];
  private chunks: ChunkRecord[] = [];

  async listDocuments(): Promise<DocumentRecord[]> {
    return this.documents
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.title.localeCompare(right.title));
  }

  async getDocument(id: string): Promise<StoredDocument | null> {
    const document = this.documents.find((item) => item.id === id);
    if (!document) return null;
    const chunks = this.chunks
      .filter((chunk) => chunk.documentId === id)
      .sort((left, right) => left.ordinal - right.ordinal)
      .map(({ embedding: _embedding, ...chunk }) => chunk);
    return { ...document, chunks };
  }

  async deleteDocument(id: string): Promise<boolean> {
    const before = this.documents.length;
    this.documents = this.documents.filter((document) => document.id !== id);
    this.chunks = this.chunks.filter((chunk) => chunk.documentId !== id);
    return this.documents.length !== before;
  }

  async upsertDocument(document: DocumentRecord, chunks: ChunkRecord[]): Promise<void> {
    this.documents = this.documents.filter((item) => item.id !== document.id);
    this.chunks = this.chunks.filter((chunk) => chunk.documentId !== document.id);
    this.documents.push(document);
    this.chunks.push(...chunks);
  }

  async search(query: string, limit: number, documentIds?: string[]): Promise<SearchHit[]> {
    const allow = documentIds?.length ? new Set(documentIds) : null;
    const chunks = allow ? this.chunks.filter((chunk) => allow.has(chunk.documentId)) : this.chunks;
    const embedding = await embedText(query);
    const ranked = rankChunks(query, embedding, chunks).slice(0, limit);
    const documents = new Map(this.documents.map((document) => [document.id, document]));
    return ranked.flatMap((hit) => {
      const document = documents.get(hit.chunk.documentId);
      return document ? [{ ...hit, document }] : [];
    });
  }

  async counts(): Promise<{ documents: number; chunks: number }> {
    return { documents: this.documents.length, chunks: this.chunks.length };
  }
}
