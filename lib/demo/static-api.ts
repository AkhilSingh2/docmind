import { mockChatResponse } from "@/lib/agent/mock-stream";
import type { DocMindMessage } from "@/lib/chat-types";
import { addDocument, ensureSeed, listSummaries, titleFromMarkdown } from "@/lib/documents";
import { MemoryVectorStore } from "@/lib/demo/memory-store";
import { latestUserText } from "@/lib/messages";

/**
 * Static demo (GitHub Pages). There is no server, so /api/* calls are answered in the
 * browser by the same retrieval, ranking and mock agent code the server uses.
 * Only active when NEXT_PUBLIC_STATIC_DEMO=true at build time.
 */
export const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";

let store: Promise<MemoryVectorStore> | null = null;
function getStore() {
  if (!store) {
    store = (async () => {
      const memory = new MemoryVectorStore();
      await ensureSeed(memory);
      return memory;
    })();
  }
  return store;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function handle(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const memory = await getStore();

  if (path === "/api/health") {
    const counts = await memory.counts();
    return json({ ok: true, provider: "mock", mode: "mock", store: "browser", authRequired: false, ...counts });
  }
  if (path === "/api/session") return json({ required: false, ok: true });
  if (path === "/api/documents/restore" && method === "POST") {
    await ensureSeed(memory);
    return json({ documents: await listSummaries(memory) });
  }
  if (path === "/api/documents" && method === "GET") return json({ documents: await listSummaries(memory) });
  if (path === "/api/documents" && method === "POST") {
    try {
      if (init.body instanceof FormData) {
        const file = init.body.get("file");
        if (!(file instanceof File)) return json({ error: "Attach a Markdown or text file." }, 400);
        if (file.name.toLowerCase().endsWith(".pdf")) {
          return json({ error: "PDF parsing runs on the server. In this demo, upload Markdown or text, or paste a note." }, 400);
        }
        const text = await file.text();
        const requested = String(init.body.get("title") ?? "").trim();
        return json(
          await addDocument(memory, {
            title: requested || titleFromMarkdown(text, file.name.replace(/\.[^.]+$/, "")),
            sourceType: "markdown",
            sourceLabel: file.name,
            text,
          }),
          201,
        );
      }
      const body = JSON.parse(String(init.body ?? "{}")) as { kind?: string; title?: string; text?: string };
      if (body.kind === "url") {
        return json({ error: "Fetching web pages needs the server. In this demo, paste the text as a note instead." }, 400);
      }
      if (body.kind === "markdown") {
        const text = String(body.text ?? "");
        return json(
          await addDocument(memory, {
            title: body.title?.trim() || titleFromMarkdown(text, "Pasted note"),
            sourceType: "markdown",
            sourceLabel: "Pasted markdown",
            text,
          }),
          201,
        );
      }
      return json({ error: "Send a file or a markdown note." }, 400);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Could not ingest that." }, 400);
    }
  }
  const match = path.match(/^\/api\/documents\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (method === "DELETE") return (await memory.deleteDocument(id)) ? json({ ok: true }) : json({ error: "Document not found." }, 404);
    const document = await memory.getDocument(id);
    return document ? json(document) : json({ error: "Document not found." }, 404);
  }
  if (path === "/api/chat" && method === "POST") {
    const body = JSON.parse(String(init.body ?? "{}")) as { messages?: DocMindMessage[]; documentIds?: unknown };
    const query = latestUserText(Array.isArray(body.messages) ? body.messages : []);
    if (!query) return json({ error: "Write a question first." }, 400);
    const ids = Array.isArray(body.documentIds) ? body.documentIds.filter((id): id is string => typeof id === "string") : undefined;
    return mockChatResponse(query, memory, ids);
  }
  return json({ error: "Not available in the static demo." }, 404);
}

export function installStaticApi(): void {
  if (!STATIC_DEMO || typeof window === "undefined") return;
  const flagged = window as typeof window & { __docmindDemo?: boolean };
  if (flagged.__docmindDemo) return;
  flagged.__docmindDemo = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (url.origin === window.location.origin && url.pathname.startsWith("/api/")) {
      if (input instanceof Request && !init) {
        init = { method: input.method, body: input.method === "GET" ? undefined : await input.text() };
      }
      return handle(url.pathname, init);
    }
    return original(input, init);
  };
}
