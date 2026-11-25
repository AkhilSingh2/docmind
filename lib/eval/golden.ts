export type GoldenQuestion = {
  query: string;
  documentId: string;
};

export const GOLDEN_QUESTIONS: GoldenQuestion[] = [
  { query: "Why does overlap matter before chunks are embedded?", documentId: "seed-chunking" },
  { query: "What does faithfulness mean in retrieval-augmented generation?", documentId: "seed-rag" },
  { query: "How do server-sent events show a tool-call step?", documentId: "seed-streaming" },
  { query: "When should I choose pgvector instead of the local JSON store?", documentId: "seed-stores" },
  { query: "What does hit rate at three measure in a RAG eval?", documentId: "seed-evals" },
];
