import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { embedderId } from "@/lib/config";
import { embedMany, embedText } from "@/lib/rag/embed";
import { rankChunks } from "@/lib/rag/rank";
import type { ChunkRecord, DocumentRecord, SearchHit } from "@/lib/types";
import type { StoredDocument, VectorStore } from "@/lib/store/types";

type FileShape = {
  version: 1;
  embedder: string;
  documents: DocumentRecord[];
  chunks: ChunkRecord[];
};

export class LocalVectorStore implements VectorStore {
  kind = "local" as const;
  private documents: DocumentRecord[] = [];
  private chunks: ChunkRecord[] = [];
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath?: string) {}

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    await this.enqueue(async () => {
      if (this.loaded) return;
      if (!this.filePath) {
        this.loaded = true;
        return;
      }
      try {
        const raw = await readFile(this.filePath, "utf8");
        const parsed = JSON.parse(raw) as FileShape;
        this.documents = parsed.documents ?? [];
        this.chunks = parsed.chunks ?? [];
        if (parsed.embedder && parsed.embedder !== embedderId() && embedderId().startsWith("hash:")) {
          await this.rehash();
          await this.persist();
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") throw error;
      }
      this.loaded = true;
    });
  }

  private async rehash(): Promise<void> {
    const vectors = await embedMany(this.chunks.map((chunk) => chunk.content));
    this.chunks = this.chunks.map((chunk, index) => ({ ...chunk, embedding: vectors[index] }));
  }

  private async persist(): Promise<void> {
    if (!this.filePath) return;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const payload: FileShape = {
      version: 1,
      embedder: embedderId(),
      documents: this.documents,
      chunks: this.chunks,
    };
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(payload));
    await rename(temporary, this.filePath);
  }

  async listDocuments(): Promise<DocumentRecord[]> {
    await this.load();
    return this.documents
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.title.localeCompare(right.title));
  }

  async getDocument(id: string): Promise<StoredDocument | null> {
    await this.load();
    const document = this.documents.find((item) => item.id === id);
    if (!document) return null;
    const chunks = this.chunks
      .filter((chunk) => chunk.documentId === id)
      .sort((left, right) => left.ordinal - right.ordinal)
      .map(({ embedding: _embedding, ...chunk }) => chunk);
    return { ...document, chunks };
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      await this.load();
      const before = this.documents.length;
      this.documents = this.documents.filter((document) => document.id !== id);
      this.chunks = this.chunks.filter((chunk) => chunk.documentId !== id);
      const removed = this.documents.length !== before;
      if (removed) await this.persist();
      return removed;
    });
  }

  async upsertDocument(document: DocumentRecord, chunks: ChunkRecord[]): Promise<void> {
    await this.enqueue(async () => {
      await this.load();
      this.documents = this.documents.filter((item) => item.id !== document.id);
      this.chunks = this.chunks.filter((chunk) => chunk.documentId !== document.id);
      this.documents.push(document);
      this.chunks.push(...chunks);
      await this.persist();
    });
  }

  async search(query: string, limit: number, documentIds?: string[]): Promise<SearchHit[]> {
    await this.load();
    const allow = documentIds?.length ? new Set(documentIds) : null;
    const chunks = allow ? this.chunks.filter((chunk) => allow.has(chunk.documentId)) : this.chunks;
    const embedding = await embedText(query);
    const ranked = rankChunks(query, embedding, chunks).slice(0, limit);
    const documents = new Map(this.documents.map((document) => [document.id, document]));
    return ranked.flatMap((hit) => {
      const document = documents.get(hit.chunk.documentId);
      if (!document) return [];
      return [{ ...hit, document }];
    });
  }

  async counts(): Promise<{ documents: number; chunks: number }> {
    await this.load();
    return { documents: this.documents.length, chunks: this.chunks.length };
  }
}
