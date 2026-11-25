import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, stepCountIs, streamText, toUIMessageStream, tool } from "ai";
import { z } from "zod";
import type { DocMindMessage } from "@/lib/chat-types";
import { getConfig } from "@/lib/config";
import type { VectorStore } from "@/lib/store/types";
import { evaluateExpression, formatNumber } from "@/lib/tools/calculator";
import { compareDocuments, retrievePassages, summariseDocument } from "@/lib/tools/library";
import { webSearch } from "@/lib/tools/web-search";

const INSTRUCTIONS = `You are DocMind, a research agent for a software engineer studying technical interviews.
Use tools before you assert facts.
For questions about the user's library, call retrieve, summariseDocument, or compareDocuments first.
Cite library passages inline as [1], [2], using the index field on each returned passage.
Do not invent passages, page numbers, or quotes.
If the library does not cover the question, say so. Use webSearch only for public web evidence and label it as web evidence, not as a library citation.
Use the calculator for every arithmetic step.
Keep the answer concise, specific, and in prose.`;

export function getLanguageModel() {
  const config = getConfig();
  if (config.llmProvider === "openai") {
    if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai.");
    return createOpenAI({ apiKey: config.openaiApiKey })(config.openaiModel);
  }
  if (config.llmProvider === "anthropic") {
    if (!config.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic.");
    return createAnthropic({ apiKey: config.anthropicApiKey })(config.anthropicModel);
  }
  if (config.llmProvider === "ollama") {
    const client = createOpenAI({
      baseURL: `${config.ollamaBaseUrl.replace(/\/$/, "")}/v1`,
      apiKey: process.env.OLLAMA_API_KEY || "ollama",
    });
    return client.chat(config.ollamaModel);
  }
  return null;
}

export function liveChatResponse(messages: DocMindMessage[], store: VectorStore, documentIds?: string[]) {
  const model = getLanguageModel();
  if (!model) throw new Error("No live model is configured.");
  const config = getConfig();
  const stream = createUIMessageStream<DocMindMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageMetadata: { mode: "live", provider: config.llmProvider } });
      const result = streamText({
        model,
        instructions: INSTRUCTIONS,
        stopWhen: stepCountIs(6),
        messages: await convertToModelMessages(messages),
        tools: {
          retrieve: tool({
            description: "Search the document library and return citable passages.",
            inputSchema: z.object({ query: z.string().describe("Standalone search query") }),
            execute: async ({ query }) => (await retrievePassages(store, query, documentIds)).output,
          }),
          calculator: tool({
            description: "Evaluate an arithmetic expression exactly.",
            inputSchema: z.object({ expression: z.string() }),
            execute: async ({ expression }) => {
              try {
                const resultValue = evaluateExpression(expression);
                return { expression, result: resultValue, formatted: formatNumber(resultValue) };
              } catch (error) {
                return { expression, error: error instanceof Error ? error.message : "Could not calculate that." };
              }
            },
          }),
          webSearch: tool({
            description: "Look up a public web snippet with DuckDuckGo Instant Answers.",
            inputSchema: z.object({ query: z.string() }),
            execute: async ({ query }) => webSearch(query),
          }),
          summariseDocument: tool({
            description: "Summarise one library document by title or subject.",
            inputSchema: z.object({ subject: z.string() }),
            execute: async ({ subject }) => (await summariseDocument(store, subject, documentIds)).output,
          }),
          compareDocuments: tool({
            description: "Compare two topics using passages from the library.",
            inputSchema: z.object({ left: z.string(), right: z.string() }),
            execute: async ({ left, right }) => (await compareDocuments(store, left, right, documentIds)).output,
          }),
        },
      });
      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false }));
    },
    onError: () => "The model request failed. Check the provider key and model name.",
  });
  return createUIMessageStreamResponse({ stream });
}
