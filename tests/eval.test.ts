import { expect, it } from "vitest";
import { planTurn } from "@/lib/agent/turn";
import { runEval } from "@/lib/eval/run";
import { ensureSeed } from "@/lib/documents";
import { LocalVectorStore } from "@/lib/store/local";

it("hits every golden question in the top three", async () => {
  const report = await runEval();
  expect(report.rate).toBe(1);
});

it("plans a calculator step and a cited retrieval", async () => {
  const store = new LocalVectorStore();
  await ensureSeed(store);
  const math = await planTurn("Calculate (12 + 8) * 3", store);
  expect(math.traces[0].name).toBe("calculator");
  expect(math.text).toContain("60");

  const research = await planTurn("Why do we overlap chunks before embedding them?", store);
  expect(research.traces[0].name).toBe("retrieve");
  expect(research.citations.length).toBeGreaterThan(0);
  expect(research.citations[0].documentId).toBe("seed-chunking");
  const source = await store.getDocument("seed-chunking");
  const quoted = source?.chunks.some((chunk) => chunk.content.includes(research.citations[0].excerpt));
  expect(quoted).toBe(true);
});
