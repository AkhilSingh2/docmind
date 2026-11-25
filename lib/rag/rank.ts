import { cosineSimilarity } from "@/lib/rag/embed";
import { tokenize } from "@/lib/rag/text";
import type { ChunkRecord } from "@/lib/types";

export const COSINE_WEIGHT = 0.62;
export const LEXICAL_WEIGHT = 0.38;

export function lexicalScores(queryTokens: string[], documents: string[]): number[] {
  const tokenized = documents.map((document) => tokenize(document));
  const total = tokenized.length || 1;
  const averageLength = tokenized.reduce((sum, tokens) => sum + tokens.length, 0) / total || 1;
  const documentFrequency = new Map<string, number>();

  for (const tokens of tokenized) {
    for (const term of new Set(tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  return tokenized.map((tokens) => {
    const termFrequency = new Map<string, number>();
    for (const token of tokens) termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    let score = 0;
    for (const term of queryTokens) {
      const frequency = termFrequency.get(term) ?? 0;
      if (!frequency) continue;
      const docsWithTerm = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (total - docsWithTerm + 0.5) / (docsWithTerm + 0.5));
      const k1 = 1.2;
      const b = 0.75;
      const denominator = frequency + k1 * (1 - b + (b * tokens.length) / averageLength);
      score += idf * ((frequency * (k1 + 1)) / denominator);
    }
    return score;
  });
}

function unit(values: number[]): number[] {
  const max = Math.max(...values, 0);
  if (max <= 0) return values.map(() => 0);
  return values.map((value) => value / max);
}

export type RankedChunk = {
  chunk: ChunkRecord;
  score: number;
  cosine: number;
  lexical: number;
};

export function rankChunks(query: string, queryEmbedding: number[], chunks: ChunkRecord[]): RankedChunk[] {
  if (!chunks.length) return [];
  const queryTokens = tokenize(query);
  const cosine = chunks.map((chunk) => Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding)));
  const lexical = unit(lexicalScores(queryTokens, chunks.map((chunk) => chunk.content)));
  const lexicalOnly = cosine.every((score) => score === 0);

  return chunks
    .map((chunk, index) => {
      const score = lexicalOnly ? lexical[index] : COSINE_WEIGHT * cosine[index] + LEXICAL_WEIGHT * lexical[index];
      return { chunk, score, cosine: cosine[index], lexical: lexical[index] };
    })
    .sort((left, right) => right.score - left.score);
}
