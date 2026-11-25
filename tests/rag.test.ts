import { describe, expect, it } from "vitest";
import { composeGroundedAnswer } from "@/lib/rag/answer";
import { chunkText, windowText } from "@/lib/rag/chunk";
import { cosineSimilarity, hashEmbed, l2norm } from "@/lib/rag/embed";
import { rankChunks } from "@/lib/rag/rank";
import type { SearchHit } from "@/lib/types";

describe("chunking", () => {
  it("keeps a short note as one passage", () => {
    const chunks = chunkText("## Notes\n\nA short research note about citations and retrieval.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe("Notes");
  });

  it("overlaps the tail of one window with the next", () => {
    const body = Array.from({ length: 40 }, (_, index) => `Sentence ${index} discusses overlap and embeddings in a library.`).join(" ");
    const windows = windowText(body, 280, 60);
    expect(windows.length).toBeGreaterThan(1);
    const tail = windows[0].slice(-40);
    expect(windows[1].includes(tail.trim().slice(-20))).toBe(true);
  });
});

describe("hash embeddings", () => {
  it("is deterministic, normalised, and nearer for related text", () => {
    const overlap = hashEmbed("Overlap keeps neighbouring chunks attached before they are embedded.", 64);
    const again = hashEmbed("Overlap keeps neighbouring chunks attached before they are embedded.", 64);
    const cooking = hashEmbed("Whisk the eggs and fold in the sugar before baking the cake.", 64);
    expect(overlap).toEqual(again);
    expect(l2norm(overlap)).toBeCloseTo(1, 5);
    expect(cosineSimilarity(overlap, again)).toBeGreaterThan(cosineSimilarity(overlap, cooking));
  });
});

describe("hybrid rank", () => {
  it("prefers the passage that shares the query terms", () => {
    const chunks = [
      { id: "a", documentId: "d", ordinal: 0, heading: null, content: "Sourdough needs a long ferment and a hot dutch oven.", embedding: hashEmbed("Sourdough needs a long ferment and a hot dutch oven.", 64) },
      { id: "b", documentId: "d", ordinal: 1, heading: null, content: "pgvector stores embeddings and builds an HNSW index for cosine distance.", embedding: hashEmbed("pgvector stores embeddings and builds an HNSW index for cosine distance.", 64) },
    ];
    const query = "When does pgvector use an HNSW index?";
    const ranked = rankChunks(query, hashEmbed(query, 64), chunks);
    expect(ranked[0].chunk.id).toBe("b");
  });
});

describe("grounded answers", () => {
  it("quotes a retrieved sentence and numbers the citation", () => {
    const content = "Overlap of about 140 characters keeps neighbouring chunks attached to the heading that explains them before those chunks are embedded.";
    const hit: SearchHit = {
      score: 0.8,
      cosine: 0.7,
      lexical: 0.9,
      document: {
        id: "seed-chunking",
        title: "Chunking and embeddings in practice",
        sourceType: "seed",
        sourceLabel: "Sample library",
        text: content,
        createdAt: "2026-01-01T00:00:00.000Z",
        seeded: true,
      },
      chunk: { id: "c1", documentId: "seed-chunking", ordinal: 0, heading: "Why chunk size matters", content, embedding: [] },
    };
    const answer = composeGroundedAnswer("Why do we overlap chunks before embedding them?", [hit]);
    expect(answer.citations).toHaveLength(1);
    expect(answer.text).toContain("[1]");
    expect(answer.text).toContain("140 characters");
    expect(answer.citations[0].excerpt.length).toBeGreaterThan(40);
    expect(content).toContain(answer.citations[0].excerpt);
  });

  it("abstains when nothing is close", () => {
    const answer = composeGroundedAnswer("quantum lattice", []);
    expect(answer.citations).toHaveLength(0);
    expect(answer.text.toLowerCase()).toContain("does not contain");
  });
});
