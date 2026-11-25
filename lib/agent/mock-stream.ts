import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { planTurn } from "@/lib/agent/turn";
import type { DocMindMessage } from "@/lib/chat-types";
import { getConfig } from "@/lib/config";
import type { VectorStore } from "@/lib/store/types";

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockChatResponse(query: string, store: VectorStore, documentIds?: string[]) {
  const config = getConfig();
  const plan = await planTurn(query, store, documentIds);
  const stream = createUIMessageStream<DocMindMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageMetadata: { mode: "mock", provider: "mock" } });
      for (const trace of plan.traces) {
        const toolCallId = crypto.randomUUID();
        writer.write({ type: "tool-input-start", toolCallId, toolName: trace.name });
        writer.write({ type: "tool-input-available", toolCallId, toolName: trace.name, input: trace.input });
        await sleep(config.mockStreamDelayMs * 3);
        writer.write({ type: "tool-output-available", toolCallId, output: trace.output });
      }
      const textId = "answer";
      writer.write({ type: "text-start", id: textId });
      for (const token of plan.text.split(/(\s+)/)) {
        if (!token) continue;
        writer.write({ type: "text-delta", id: textId, delta: token });
        if (/\S/.test(token)) await sleep(config.mockStreamDelayMs);
      }
      writer.write({ type: "text-end", id: textId });
      for (const citation of plan.citations) {
        writer.write({ type: "data-citation", id: `cite-${citation.chunkId}-${citation.index}`, data: citation });
      }
      writer.write({ type: "finish", finishReason: "stop" });
      writer.setOutcome({ status: "completed" });
    },
    onError: (error) => (error instanceof Error ? error.message : "The demo agent failed."),
  });
  return createUIMessageStreamResponse({ stream });
}
