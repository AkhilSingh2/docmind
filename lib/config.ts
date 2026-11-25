export const DEFAULT_EMBEDDING_DIMENSIONS = 256;

export type LlmProvider = "mock" | "openai" | "anthropic" | "ollama";
export type VectorStoreKind = "local" | "pgvector";
export type EmbeddingProvider = "hash" | "openai";

export type AppConfig = {
  llmProvider: LlmProvider;
  vectorStore: VectorStoreKind;
  embeddingProvider: EmbeddingProvider;
  embeddingDimensions: number;
  databaseUrl?: string;
  accessKey?: string;
  mockStreamDelayMs: number;
  openaiApiKey?: string;
  openaiModel: string;
  openaiEmbeddingModel: string;
  anthropicApiKey?: string;
  anthropicModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  dataDir: string;
};

function asProvider(value: string | undefined): LlmProvider {
  if (value === "openai" || value === "anthropic" || value === "ollama") return value;
  return "mock";
}

export function getConfig(): AppConfig {
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? DEFAULT_EMBEDDING_DIMENSIONS);
  const delay = Number(process.env.MOCK_STREAM_DELAY_MS ?? 12);
  return {
    llmProvider: asProvider(process.env.LLM_PROVIDER),
    vectorStore: process.env.VECTOR_STORE === "pgvector" ? "pgvector" : "local",
    embeddingProvider: process.env.EMBEDDING_PROVIDER === "openai" ? "openai" : "hash",
    embeddingDimensions: Number.isFinite(dimensions) && dimensions > 8 ? Math.floor(dimensions) : DEFAULT_EMBEDDING_DIMENSIONS,
    databaseUrl: process.env.DATABASE_URL || undefined,
    accessKey: process.env.DOCMIND_ACCESS_KEY || undefined,
    mockStreamDelayMs: Number.isFinite(delay) && delay >= 0 ? delay : 12,
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    ollamaModel: process.env.OLLAMA_MODEL || "llama3.2",
    dataDir: process.env.DOCMIND_DATA_DIR || ".data",
  };
}

export function embedderId(config = getConfig()): string {
  if (config.embeddingProvider === "openai") {
    return `openai:${config.openaiEmbeddingModel}:${config.embeddingDimensions}`;
  }
  return `hash:${config.embeddingDimensions}`;
}
