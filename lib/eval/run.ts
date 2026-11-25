import { GOLDEN_QUESTIONS } from "@/lib/eval/golden";
import { ensureSeed } from "@/lib/documents";
import { LocalVectorStore } from "@/lib/store/local";
import type { VectorStore } from "@/lib/store/types";

export type EvalReport = {
  hits: number;
  total: number;
  rate: number;
  results: Array<{ query: string; documentId: string; hit: boolean; rank: number; top: string | null }>;
};

export async function runEval(store?: VectorStore): Promise<EvalReport> {
  const local = store ?? new LocalVectorStore();
  await ensureSeed(local);
  const results = [];
  for (const question of GOLDEN_QUESTIONS) {
    const hits = await local.search(question.query, 3);
    const found = hits.findIndex((hit) => hit.document.id === question.documentId);
    results.push({
      query: question.query,
      documentId: question.documentId,
      hit: found >= 0,
      rank: found + 1,
      top: hits[0]?.document.title ?? null,
    });
  }
  const matched = results.filter((result) => result.hit).length;
  return { hits: matched, total: results.length, rate: matched / results.length, results };
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("run.ts") || entry.endsWith("run.js")) {
  runEval()
    .then((report) => {
      for (const result of report.results) {
        const mark = result.hit ? "hit" : "miss";
        console.log(`${mark}\trank ${result.rank || "-"}\t${result.top}\t${result.query}`);
      }
      console.log(`hit@3 ${report.hits}/${report.total} (${Math.round(report.rate * 100)}%)`);
      if (report.rate < 1) process.exitCode = 1;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
