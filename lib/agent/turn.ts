import { routeIntent, type Intent } from "@/lib/agent/intent";
import type { VectorStore } from "@/lib/store/types";
import { CalculatorError, evaluateExpression, formatNumber } from "@/lib/tools/calculator";
import { compareDocuments, retrievePassages, summariseDocument } from "@/lib/tools/library";
import { webSearch, type WebSearchOutput } from "@/lib/tools/web-search";
import type { CitationData } from "@/lib/types";

export type ToolTrace = {
  name: "retrieve" | "calculator" | "webSearch" | "summariseDocument" | "compareDocuments";
  input: Record<string, unknown>;
  output: unknown;
};

export type PlannedTurn = {
  intent: Intent;
  traces: ToolTrace[];
  text: string;
  citations: CitationData[];
};

export async function planTurn(query: string, store: VectorStore, documentIds?: string[]): Promise<PlannedTurn> {
  const intent = routeIntent(query);
  if (intent.type === "calculate") {
    try {
      const result = evaluateExpression(intent.expression);
      const formatted = formatNumber(result);
      return {
        intent,
        citations: [],
        traces: [{ name: "calculator", input: { expression: intent.expression }, output: { expression: intent.expression, result, formatted } }],
        text: `${intent.expression} = ${formatted}.`,
      };
    } catch (error) {
      const message = error instanceof CalculatorError ? error.message : "Could not calculate that.";
      return {
        intent,
        citations: [],
        traces: [{ name: "calculator", input: { expression: intent.expression }, output: { expression: intent.expression, error: message } }],
        text: message,
      };
    }
  }

  if (intent.type === "web") {
    const output: WebSearchOutput = await webSearch(intent.query);
    const lines = output.results.map((result) => (result.url ? `${result.snippet} (${result.url})` : result.snippet)).join("\n\n");
    return {
      intent,
      citations: [],
      traces: [{ name: "webSearch", input: { query: intent.query }, output }],
      text: `${output.note}\n\n${lines}`,
    };
  }

  if (intent.type === "summarise") {
    const result = await summariseDocument(store, intent.subject, documentIds);
    return {
      intent,
      citations: result.citations,
      traces: [{ name: "summariseDocument", input: { subject: intent.subject }, output: result.output }],
      text: result.text,
    };
  }

  if (intent.type === "compare") {
    const result = await compareDocuments(store, intent.left, intent.right, documentIds);
    return {
      intent,
      citations: result.citations,
      traces: [
        {
          name: "compareDocuments",
          input: { left: intent.left, right: intent.right },
          output: result.output,
        },
      ],
      text: result.text,
    };
  }

  const retrieved = await retrievePassages(store, intent.query, documentIds);
  return {
    intent,
    citations: retrieved.answer.citations,
    traces: [{ name: "retrieve", input: { query: intent.query }, output: retrieved.output }],
    text: retrieved.answer.text,
  };
}
