import type { ChunkRecord, ChunkView, DocumentRecord, SearchHit } from "@/lib/types";

export type StoredDocument = DocumentRecord & { chunks: ChunkView[] };

export interface VectorStore {
  kind: "local" | "pgvector";
  listDocuments(): Promise<DocumentRecord[]>;
  getDocument(id: string): Promise<StoredDocument | null>;
  deleteDocument(id: string): Promise<boolean>;
  upsertDocument(document: DocumentRecord, chunks: ChunkRecord[]): Promise<void>;
  search(query: string, limit: number, documentIds?: string[]): Promise<SearchHit[]>;
  counts(): Promise<{ documents: number; chunks: number }>;
}
