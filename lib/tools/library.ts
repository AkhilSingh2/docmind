import { composeGroundedAnswer } from "@/lib/rag/answer";
import { bodySentences, tokenize } from "@/lib/rag/text";
import type { VectorStore } from "@/lib/store/types";
import type { CitationData, DocumentRecord, Passage, SearchHit, ToolPassageOutput } from "@/lib/types";

function passagesFromHits(hits: SearchHit[]): Passage[] {
  return hits.map((hit, index) => ({
    index: index + 1,
    chunkId: hit.chunk.id,
    documentId: hit.document.id,
    documentTitle: hit.document.title,
    heading: hit.chunk.heading,
    excerpt: bodySentences(hit.chunk.content, hit.chunk.heading)[0] ?? hit.chunk.content.slice(0, 280),
    score: hit.score,
  }));
}

export function bestDocument(documents: DocumentRecord[], subject: string): DocumentRecord | null {
  const query = subject.trim().toLowerCase();
  const tokens = tokenize(subject);
  let best: { document: DocumentRecord; score: number } | null = null;
  for (const document of documents) {
    const title = document.title.toLowerCase();
    let score = 0;
    if (query && title.includes(query)) score += 6;
    const titleTokens = new Set(tokenize(document.title));
    for (const token of tokens) if (titleTokens.has(token)) score += 1;
    if (!best || score > best.score) best = { document, score };
  }
  if (!best || best.score <= 0) return null;
  return best.document;
}

export async function retrievePassages(
  store: VectorStore,
  query: string,
  documentIds?: string[],
  limit = 4,
): Promise<{ hits: SearchHit[]; output: ToolPassageOutput; answer: { text: string; citations: CitationData[] } }> {
  const hits = await store.search(query, limit, documentIds);
  const answer = composeGroundedAnswer(query, hits);
  return {
    hits,
    answer,
    output: {
      summary: hits.length ? `Found ${hits.length} passage${hits.length === 1 ? "" : "s"} in the library.` : "No passages matched.",
      passages: answer.citations.length ? answer.citations : passagesFromHits(hits),
    },
  };
}

export async function summariseDocument(
  store: VectorStore,
  subject: string,
  documentIds?: string[],
): Promise<{ output: ToolPassageOutput; text: string; citations: CitationData[] }> {
  const documents = (await store.listDocuments()).filter((document) => !documentIds?.length || documentIds.includes(document.id));
  const match = bestDocument(documents, subject) ?? (documents.length === 1 ? documents[0] : null);
  if (!match) {
    const titles = documents.map((document) => document.title).join("; ");
    return {
      output: { summary: "No document matched that title.", passages: [] },
      citations: [],
      text: titles
        ? `I could not match that title. The library currently has: ${titles}.`
        : "The library is empty, so there is nothing to summarise.",
    };
  }
  const full = await store.getDocument(match.id);
  const chunks = full?.chunks ?? [];
  const citations: CitationData[] = chunks.slice(0, 4).map((chunk, index) => ({
    index: index + 1,
    chunkId: chunk.id,
    documentId: match.id,
    documentTitle: match.title,
    heading: chunk.heading,
    excerpt: bodySentences(chunk.content, chunk.heading)[0] ?? chunk.content.slice(0, 280),
    score: 1,
  }));
  const lines = citations.map((citation) => `${citation.excerpt} [${citation.index}]`).join("\n\n");
  return {
    citations,
    output: { summary: `Summarised ${match.title}.`, passages: citations },
    text: `Summary of ${match.title}.\n\n${lines}`,
  };
}

export async function compareDocuments(
  store: VectorStore,
  leftQuery: string,
  rightQuery: string,
  documentIds?: string[],
): Promise<{ output: ToolPassageOutput; text: string; citations: CitationData[] }> {
  const [leftHits, rightHits] = await Promise.all([
    store.search(leftQuery, 2, documentIds),
    store.search(rightQuery, 2, documentIds),
  ]);
  const chosen: SearchHit[] = [];
  for (const hit of [...leftHits, ...rightHits]) {
    if (!chosen.some((item) => item.chunk.id === hit.chunk.id)) chosen.push(hit);
  }
  const citations: CitationData[] = chosen.slice(0, 4).map((hit, index) => ({
    index: index + 1,
    chunkId: hit.chunk.id,
    documentId: hit.document.id,
    documentTitle: hit.document.title,
    heading: hit.chunk.heading,
    excerpt: bodySentences(hit.chunk.content, hit.chunk.heading)[0] ?? hit.chunk.content.slice(0, 280),
    score: hit.score,
  }));
  if (!citations.length) {
    return {
      citations,
      output: { summary: "Nothing in the library matched either side.", passages: [] },
      text: "I could not find passages for either side of that comparison.",
    };
  }
  const leftTitle = leftHits[0]?.document.title ?? leftQuery;
  const rightTitle = rightHits[0]?.document.title ?? rightQuery;
  const body = citations.map((citation) => `${citation.excerpt} [${citation.index}]`).join("\n\n");
  return {
    citations,
    output: {
      summary: `Compared “${leftQuery}” (${leftTitle}) with “${rightQuery}” (${rightTitle}).`,
      passages: citations,
    },
    text: `Comparison of ${leftTitle} and ${rightTitle}.\n\n${body}`,
  };
}
