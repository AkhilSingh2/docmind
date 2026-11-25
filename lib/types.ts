export type SourceType = "markdown" | "pdf" | "url" | "seed";

export type DocumentRecord = {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceLabel: string;
  text: string;
  createdAt: string;
  seeded: boolean;
};

export type ChunkRecord = {
  id: string;
  documentId: string;
  ordinal: number;
  heading: string | null;
  content: string;
  embedding: number[];
};

export type ChunkView = Omit<ChunkRecord, "embedding">;

export type DocumentSummary = {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceLabel: string;
  createdAt: string;
  seeded: boolean;
  chunkCount: number;
  preview: string;
};

export type SearchHit = {
  chunk: ChunkRecord;
  document: DocumentRecord;
  score: number;
  cosine: number;
  lexical: number;
};

export type CitationData = {
  index: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  heading: string | null;
  excerpt: string;
  score: number;
};

export type Passage = CitationData;

export type ToolPassageOutput = {
  summary: string;
  passages: Passage[];
};
