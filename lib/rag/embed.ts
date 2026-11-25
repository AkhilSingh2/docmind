import { getConfig } from "@/lib/config";
import { tokenize } from "@/lib/rag/text";

function fnv(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function l2norm(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

export function hashEmbed(text: string, dimensions = 256): number[] {
  const vector = new Float64Array(dimensions);
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) ?? 0) + 1);

  for (const [token, count] of counts) {
    const weight = 1 + Math.log(count);
    const primary = fnv(token) % dimensions;
    const primarySign = fnv(`${token}#`) % 2 === 0 ? 1 : -1;
    vector[primary] += primarySign * weight;
    const secondary = fnv(`2:${token}`) % dimensions;
    const secondarySign = fnv(`${token}$`) % 2 === 0 ? 1 : -1;
    vector[secondary] += secondarySign * weight * 0.5;
  }

  const compact = text.toLowerCase();
  for (let index = 0; index < compact.length - 2; index += 1) {
    const trigram = compact.slice(index, index + 3);
    if (!/[a-z0-9]{3}/.test(trigram)) continue;
    const bucket = fnv(`3:${trigram}`) % dimensions;
    vector[bucket] += fnv(trigram) % 2 === 0 ? 0.12 : -0.12;
  }

  const norm = l2norm(Array.from(vector)) || 1;
  return Array.from(vector, (value) => value / norm);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  for (let index = 0; index < left.length; index += 1) dot += left[index] * right[index];
  return dot;
}

export async function embedText(text: string): Promise<number[]> {
  const config = getConfig();
  if (config.embeddingProvider === "openai") {
    if (!config.openaiApiKey) {
      throw new Error("EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY.");
    }
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openaiEmbeddingModel,
        input: text,
        dimensions: config.embeddingDimensions,
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI embeddings failed (${response.status}).`);
    }
    const payload = (await response.json()) as { data?: Array<{ embedding: number[] }> };
    const embedding = payload.data?.[0]?.embedding;
    if (!embedding) throw new Error("OpenAI embeddings returned no vector.");
    return embedding;
  }
  return hashEmbed(text, config.embeddingDimensions);
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  const config = getConfig();
  if (config.embeddingProvider !== "openai") {
    return texts.map((text) => hashEmbed(text, config.embeddingDimensions));
  }
  if (!config.openaiApiKey) throw new Error("EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY.");
  const vectors: number[][] = [];
  const batchSize = 64;
  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize);
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openaiEmbeddingModel,
        input: batch,
        dimensions: config.embeddingDimensions,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI embeddings failed (${response.status}).`);
    const payload = (await response.json()) as { data?: Array<{ embedding: number[]; index: number }> };
    const ordered = (payload.data ?? []).slice().sort((a, b) => a.index - b.index);
    if (ordered.length !== batch.length) throw new Error("OpenAI embeddings returned an incomplete batch.");
    vectors.push(...ordered.map((item) => item.embedding));
  }
  return vectors;
}
