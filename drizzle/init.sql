CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  title text NOT NULL,
  source_type text NOT NULL,
  source_label text NOT NULL,
  text text NOT NULL,
  seeded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  heading text,
  content text NOT NULL,
  embedding vector(256) NOT NULL
);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);
