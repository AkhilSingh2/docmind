import { bodySentences, tokenize } from "@/lib/rag/text";
import type { CitationData, SearchHit } from "@/lib/types";

const ABSTAIN_SCORE = 0.08;

function sentenceScore(sentence: string, queryTokens: string[]): number {
  if (!queryTokens.length) return 0;
  const tokens = new Set(tokenize(sentence));
  let hits = 0;
  for (const token of queryTokens) if (tokens.has(token)) hits += 1;
  return hits / queryTokens.length;
}

export function composeGroundedAnswer(query: string, hits: SearchHit[]): { text: string; citations: CitationData[] } {
  const useful = hits.filter((hit) => hit.score >= ABSTAIN_SCORE);
  const queryTokens = tokenize(query);
  if (!useful.length) {
    return {
      text: "The library does not contain a passage that supports an answer to that. Ask something closer to the loaded notes, narrow the source filter, or search the web.",
      citations: [],
    };
  }

  const candidates: Array<{ hit: SearchHit; sentence: string; score: number }> = [];
  for (const hit of useful) {
    const pieces = bodySentences(hit.chunk.content, hit.chunk.heading);
    const pool = pieces.length ? pieces : [hit.chunk.content.replace(/\s+/g, " ").trim()];
    for (const sentence of pool) {
      candidates.push({ hit, sentence, score: sentenceScore(sentence, queryTokens) });
    }
  }

  const chosen: Array<{ hit: SearchHit; sentence: string; score: number }> = [];
  const usedChunks = new Set<string>();
  const ranked = candidates.slice().sort((left, right) => right.score - left.score || right.hit.score - left.hit.score);
  for (const candidate of ranked) {
    if (candidate.score <= 0 && chosen.length > 0) continue;
    if (usedChunks.has(candidate.hit.chunk.id) && chosen.length < ranked.length) {
      const unseenLeft = ranked.some((item) => !usedChunks.has(item.hit.chunk.id) && item.score > 0);
      if (unseenLeft) continue;
    }
    if (chosen.some((item) => item.sentence === candidate.sentence)) continue;
    chosen.push(candidate);
    usedChunks.add(candidate.hit.chunk.id);
    if (chosen.length === 3) break;
  }

  if (!chosen.length || (chosen[0].score === 0 && useful[0].score < 0.15)) {
    return {
      text: "I found only a weak match in the library, so I am not going to stretch it into an answer. Try a more specific question or search the web.",
      citations: [],
    };
  }

  const citations: CitationData[] = chosen.map((item, index) => ({
    index: index + 1,
    chunkId: item.hit.chunk.id,
    documentId: item.hit.document.id,
    documentTitle: item.hit.document.title,
    heading: item.hit.chunk.heading,
    excerpt: item.sentence,
    score: item.hit.score,
  }));

  const titles = [...new Set(citations.map((citation) => citation.documentTitle))];
  const lead = titles.length === 1 ? `The closest notes are in ${titles[0]}.` : `The closest notes are in ${titles.join(" and ")}.`;
  const body = citations.map((citation) => `${citation.excerpt} [${citation.index}]`).join("\n\n");
  return { text: `${lead}\n\n${body}`, citations };
}
