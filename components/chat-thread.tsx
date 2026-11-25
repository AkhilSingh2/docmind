"use client";

import type { UIMessage } from "ai";
import { Calculator, GitCompare, Globe, Library, ScrollText } from "lucide-react";
import type { ReactNode } from "react";
import type { CitationData } from "@/lib/types";

const TOOL_LABELS: Record<string, string> = {
  retrieve: "Retrieve",
  calculator: "Calculator",
  webSearch: "Web search",
  summariseDocument: "Summarise",
  compareDocuments: "Compare",
};

function ToolGlyph({ name }: { name: string }) {
  const className = "size-3.5";
  if (name === "calculator") return <Calculator aria-hidden className={className} />;
  if (name === "webSearch") return <Globe aria-hidden className={className} />;
  if (name === "summariseDocument") return <ScrollText aria-hidden className={className} />;
  if (name === "compareDocuments") return <GitCompare aria-hidden className={className} />;
  return <Library aria-hidden className={className} />;
}

function citationsFromMessage(message: UIMessage): Map<number, CitationData> {
  const map = new Map<number, CitationData>();
  for (const part of message.parts) {
    if (part.type === "data-citation") {
      const data = part.data as CitationData;
      map.set(data.index, data);
      continue;
    }
    if (!part.type.startsWith("tool-") || !("state" in part) || part.state !== "output-available") continue;
    const output = part.output as { passages?: CitationData[] } | undefined;
    for (const passage of output?.passages ?? []) map.set(passage.index, passage);
  }
  return map;
}

function renderBold(text: string): ReactNode[] {
  const pieces = text.split(/(\*\*[^*]+\*\*)/g);
  return pieces.map((piece, index) => {
    if (piece.startsWith("**") && piece.endsWith("**")) {
      return <strong key={index}>{piece.slice(2, -2)}</strong>;
    }
    return <span key={index}>{piece}</span>;
  });
}

function AnswerBody({ text, citations, onOpen }: { text: string; citations: Map<number, CitationData>; onOpen: (citation: CitationData) => void }) {
  const nodes: ReactNode[] = [];
  const pattern = /\[(\d+)\]/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(<span key={`t-${last}`}>{renderBold(text.slice(last, start))}</span>);
    const number = Number(match[1]);
    const citation = citations.get(number);
    nodes.push(
      <button
        key={`c-${start}`}
        type="button"
        className="cite"
        data-testid="citation"
        disabled={!citation}
        aria-label={citation ? `Open source ${number}, ${citation.documentTitle}` : `Citation ${number}`}
        onClick={() => citation && onOpen(citation)}
      >
        {number}
      </button>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) nodes.push(<span key={`t-${last}`}>{renderBold(text.slice(last))}</span>);
  return <div className="answer whitespace-pre-wrap">{nodes}</div>;
}

function ToolStep({ part }: { part: UIMessage["parts"][number] }) {
  if (!part.type.startsWith("tool-") || !("toolCallId" in part)) return null;
  const name = part.type.slice("tool-".length);
  const label = TOOL_LABELS[name] ?? name;
  const state = "state" in part ? part.state : "input-streaming";
  const running = state === "input-streaming" || state === "input-available";
  const output = "output" in part ? (part.output as Record<string, unknown> | undefined) : undefined;
  const summary = typeof output?.summary === "string" ? output.summary : typeof output?.formatted === "string" ? `= ${output.formatted}` : typeof output?.error === "string" ? output.error : null;

  return (
    <li data-testid="tool-step" className="rounded-2xl border border-line bg-paper/70 px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="grid size-7 place-items-center rounded-full bg-accent/15 text-accent">
          <ToolGlyph name={name} />
        </span>
        <span className="font-medium">{label}</span>
        <span className="text-muted">{running ? "Running" : state === "output-error" ? "Failed" : "Done"}</span>
      </div>
      {summary && <p className="mt-2 text-sm text-muted">{summary}</p>}
      {"input" in part && part.input != null && (
        <details className="mt-2 text-xs text-muted">
          <summary>Input and output</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{JSON.stringify({ input: part.input, output: output ?? null }, null, 2)}</pre>
        </details>
      )}
    </li>
  );
}

export function ChatThread({
  messages,
  status,
  onOpenCitation,
}: {
  messages: UIMessage[];
  status: string;
  onOpenCitation: (citation: CitationData) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {messages.map((message) => {
        if (message.role === "user") {
          const text = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n");
          return (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-3xl bg-ink px-4 py-3 text-paper">{text}</p>
            </div>
          );
        }
        const citations = citationsFromMessage(message);
        const text = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
        const tools = message.parts.filter((part) => part.type.startsWith("tool-"));
        return (
          <article key={message.id} data-testid="assistant" className="space-y-3">
            {tools.length > 0 && (
              <ol className="space-y-2" aria-label="Tool calls">
                {tools.map((part) => (
                  <ToolStep key={"toolCallId" in part ? part.toolCallId : part.type} part={part} />
                ))}
              </ol>
            )}
            {text && <AnswerBody text={text} citations={citations} onOpen={onOpenCitation} />}
          </article>
        );
      })}
      {status === "submitted" && <p className="text-sm text-muted">Reading the library…</p>}
    </div>
  );
}
