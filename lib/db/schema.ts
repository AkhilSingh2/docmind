import { boolean, integer, pgTable, text, timestamp, vector } from "drizzle-orm/pg-core";
import { DEFAULT_EMBEDDING_DIMENSIONS } from "@/lib/config";

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  sourceType: text("source_type").notNull(),
  sourceLabel: text("source_label").notNull(),
  text: text("text").notNull(),
  seeded: boolean("seeded").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  ordinal: integer("ordinal").notNull(),
  heading: text("heading"),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: DEFAULT_EMBEDDING_DIMENSIONS }).notNull(),
});
