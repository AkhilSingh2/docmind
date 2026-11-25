import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions";
import { getSql, getDatabase } from "@/lib/db/client";
import { chunks, documents } from "@/lib/db/schema";
import { embedText } from "@/lib/rag/embed";
import { rankChunks } from "@/lib/rag/rank";
import type { ChunkRecord, DocumentRecord, SearchHit, SourceType } from "@/lib/types";
import type { StoredDocument, VectorStore } from "@/lib/store/types";

function toDocument(row: typeof documents.$inferSelect): DocumentRecord {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.sourceType as SourceType,
    sourceLabel: row.sourceLabel,
    text: row.text,
    seeded: row.seeded,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PgVectorStore implements VectorStore {
  kind = "pgvector" as const;
  private readyPromise: Promise<void> | null = null;

  ready(): Promise<void> {
    if (!this.readyPromise) this.readyPromise = this.prepare();
    return this.readyPromise;
  }

  private async prepare(): Promise<void> {
    const sql = getSql();
    await sql`select 1`;
    const existing = await sql<{ name: string | null }[]>`select to_regclass('public.chunks') as name`;
    if (!existing[0]?.name) {
      const ddl = await readFile(path.join(process.cwd(), "drizzle", "init.sql"), "utf8");
      await sql.unsafe(ddl);
    }
  }

  async listDocuments(): Promise<DocumentRecord[]> {
    await this.ready();
    const rows = await getDatabase().select().from(documents);
    return rows.map(toDocument).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getDocument(id: string): Promise<StoredDocument | null> {
    await this.ready();
    const db = getDatabase();
    const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!row) return null;
    const chunkRows = await db.select().from(chunks).where(eq(chunks.documentId, id));
    return {
      ...toDocument(row),
      chunks: chunkRows
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((chunk) => ({
          id: chunk.id,
          documentId: chunk.documentId,
          ordinal: chunk.ordinal,
          heading: chunk.heading,
          content: chunk.content,
        })),
    };
  }

  async deleteDocument(id: string): Promise<boolean> {
    await this.ready();
    const removed = await getDatabase().delete(documents).where(eq(documents.id, id)).returning({ id: documents.id });
    return removed.length > 0;
  }

  async upsertDocument(document: DocumentRecord, nextChunks: ChunkRecord[]): Promise<void> {
    await this.ready();
    const db = getDatabase();
    await db.delete(documents).where(eq(documents.id, document.id));
    await db.insert(documents).values({
      id: document.id,
      title: document.title,
      sourceType: document.sourceType,
      sourceLabel: document.sourceLabel,
      text: document.text,
      seeded: document.seeded,
      createdAt: new Date(document.createdAt),
    });
    if (nextChunks.length) {
      await db.insert(chunks).values(
        nextChunks.map((chunk) => ({
          id: chunk.id,
          documentId: chunk.documentId,
          ordinal: chunk.ordinal,
          heading: chunk.heading,
          content: chunk.content,
          embedding: chunk.embedding,
        })),
      );
    }
  }

  async search(query: string, limit: number, documentIds?: string[]): Promise<SearchHit[]> {
    await this.ready();
    const embedding = await embedText(query);
    const db = getDatabase();
    const distance = cosineDistance(chunks.embedding, embedding);
    const filters = documentIds?.length ? inArray(chunks.documentId, documentIds) : undefined;
    const base = db
      .select({
        id: chunks.id,
        documentId: chunks.documentId,
        ordinal: chunks.ordinal,
        heading: chunks.heading,
        content: chunks.content,
        embedding: chunks.embedding,
      })
      .from(chunks)
      .orderBy(distance)
      .limit(Math.max(limit * 8, 24));
    const rows = filters ? await base.where(filters) : await base;
    const docRows = rows.length
      ? await db.select().from(documents).where(inArray(documents.id, [...new Set(rows.map((row) => row.documentId))]))
      : [];
    const byId = new Map(docRows.map((row) => [row.id, toDocument(row)]));
    const ranked = rankChunks(
      query,
      embedding,
      rows.map((row) => ({
        id: row.id,
        documentId: row.documentId,
        ordinal: row.ordinal,
        heading: row.heading,
        content: row.content,
        embedding: row.embedding,
      })),
    ).slice(0, limit);
    return ranked.flatMap((hit) => {
      const document = byId.get(hit.chunk.documentId);
      if (!document) return [];
      return [{ ...hit, document }];
    });
  }

  async counts(): Promise<{ documents: number; chunks: number }> {
    await this.ready();
    const sql = getSql();
    const [docs] = await sql<{ count: string }[]>`select count(*)::text as count from documents`;
    const [chunkRows] = await sql<{ count: string }[]>`select count(*)::text as count from chunks`;
    return { documents: Number(docs?.count ?? 0), chunks: Number(chunkRows?.count ?? 0) };
  }
}
