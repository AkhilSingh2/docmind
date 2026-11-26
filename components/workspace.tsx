"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Menu, Moon, Square, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ChatThread } from "@/components/chat-thread";
import { cn } from "@/lib/cn";
import { LibraryPanel } from "@/components/library-panel";
import { SourceDrawer } from "@/components/source-drawer";
import { UploadDialog } from "@/components/upload-dialog";
import type { DocMindMessage } from "@/lib/chat-types";
import type { CitationData, DocumentSummary } from "@/lib/types";

const PROMPTS = [
  { label: "Why overlap chunks?", text: "Why do we overlap chunks before embedding them?" },
  { label: "Local store or pgvector", text: "Compare the local vector store with pgvector" },
  { label: "How are answers evaluated?", text: "How should I evaluate a RAG system?" },
  { label: "A quick calculation", text: "Calculate (12 + 8) * 3" },
];

type Health = { provider: string; mode: "mock" | "live"; store: string; authRequired: boolean };

export function Workspace() {
  const [session, setSession] = useState(0);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [locked, setLocked] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/documents");
    if (response.status === 401) {
      setLocked(true);
      return;
    }
    const payload = (await response.json()) as { documents?: DocumentSummary[]; error?: string };
    if (!response.ok) {
      setLibraryError(payload.error ?? "Could not load the library.");
      return;
    }
    setLocked(false);
    setDocuments(payload.documents ?? []);
  }

  useEffect(() => {
    void fetch("/api/health")
      .then((response) => response.json())
      .then((payload: Health) => setHealth(payload))
      .catch(() => setLibraryError("DocMind did not start."));
    void fetch("/api/session")
      .then((response) => response.json())
      .then((payload: { required: boolean; ok: boolean }) => {
        if (payload.required && !payload.ok) setLocked(true);
        else void refresh();
      });
  }, []);

  if (locked) return <AccessGate onUnlock={() => { setLocked(false); void refresh(); }} />;

  return (
    <ChatSession
      key={session}
      documents={documents}
      selected={selected}
      health={health}
      libraryError={libraryError}
      onToggle={(id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
      onClear={() => setSelected([])}
      onRefresh={() => void refresh()}
      onNew={() => setSession((value) => value + 1)}
      onDelete={async (id) => {
        await fetch(`/api/documents/${id}`, { method: "DELETE" });
        setSelected((current) => current.filter((item) => item !== id));
        await refresh();
      }}
      onRestore={async () => {
        await fetch("/api/documents/restore", { method: "POST" });
        await refresh();
      }}
    />
  );
}

function ChatSession({
  documents,
  selected,
  health,
  libraryError,
  onToggle,
  onClear,
  onRefresh,
  onNew,
  onDelete,
  onRestore,
}: {
  documents: DocumentSummary[];
  selected: string[];
  health: Health | null;
  libraryError: string | null;
  onToggle: (id: string) => void;
  onClear: () => void;
  onRefresh: () => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRestore: () => void;
}) {
  const reduce = useReducedMotion();
  const { setTheme } = useTheme();
  const [input, setInput] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [citation, setCitation] = useState<CitationData | null>(null);
  const [transport] = useState(() => new DefaultChatTransport<DocMindMessage>({ api: "/api/chat" }));
  const { messages, sendMessage, status, stop, error } = useChat<DocMindMessage>({ transport });

  const busy = status === "submitted" || status === "streaming";
  const demo = (health?.mode ?? "mock") === "mock";

  function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    void sendMessage({ text: question }, { body: { documentIds: selected } });
  }

  const library = (
    <LibraryPanel
      documents={documents}
      selected={selected}
      onToggle={onToggle}
      onClear={onClear}
      onUpload={() => setUploadOpen(true)}
      onRestore={onRestore}
      onDelete={onDelete}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line/80 px-3 py-3 md:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button type="button" className="grid size-10 place-items-center rounded-full border border-line md:hidden" data-testid="library-toggle" aria-label="Open library" onClick={() => setLibraryOpen(true)}>
            <Menu aria-hidden className="size-4" />
          </button>
          <div className="grid size-10 place-items-center rounded-2xl bg-ink text-paper">
            <span className="font-serif text-lg">D</span>
          </div>
          <div className="min-w-0">
            <p className="shrink-0 font-serif text-lg leading-none md:text-xl">DocMind</p>
            <p className="mt-1 hidden truncate text-xs text-muted sm:block">Research that cites its sources</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span data-testid="demo-badge" className="rounded-full border border-line bg-panel px-2.5 py-1 text-xs text-muted">
            {demo ? (
              <>
                <span className="md:hidden">Demo mode</span>
                <span className="hidden md:inline">{health?.store === "browser" ? "Demo mode · sample data" : "Demo mode · no API key"}</span>
              </>
            ) : (
              `Live · ${health?.provider}`
            )}
            {health?.store === "pgvector" ? " · pgvector" : ""}
          </span>
          <button type="button" onClick={onNew} aria-label="New chat" className="rounded-full border border-line bg-panel px-3 py-1.5 text-sm">
            <span className="md:hidden">New</span>
            <span className="hidden md:inline">New chat</span>
          </button>
          <button
            type="button"
            aria-label="Toggle color theme"
            onClick={() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}
            className="grid size-10 place-items-center rounded-full border border-line bg-panel"
          >
            <Sun aria-hidden className="hidden size-4 dark:block" />
            <Moon aria-hidden className="size-4 dark:hidden" />
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden border-r border-line md:block" data-testid="library-panel">
          {library}
        </aside>
        <main id="chat" className={cn("flex min-h-0 flex-col", citation ? "md:pr-[420px]" : undefined)}>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
            {messages.length === 0 ? (
              <motion.section initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex min-h-full max-w-3xl flex-col justify-center">
                <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">Sample library loaded</p>
                <h1 className="mt-3 max-w-xl font-serif text-5xl leading-[1.05] md:text-6xl">Ask the library.</h1>
                <p className="mt-4 max-w-xl text-lg text-muted">
                  DocMind retrieves a passage, shows the tool call, and streams an answer whose citations jump back to the source. Demo mode quotes the notes. It does not invent them.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {PROMPTS.map((prompt) => (
                    <button key={prompt.label} type="button" onClick={() => ask(prompt.text)} className="rounded-3xl border border-line bg-panel px-4 py-4 text-left hover:border-accent">
                      <span className="block text-xs text-muted">Try</span>
                      <span className="mt-1 block font-medium">{prompt.label}</span>
                    </button>
                  ))}
                </div>
              </motion.section>
            ) : (
              <ChatThread messages={messages} status={status} onOpenCitation={setCitation} />
            )}
            {libraryError && <p className="mx-auto mt-4 max-w-3xl text-sm text-ember">{libraryError}</p>}
            {error && <p className="mx-auto mt-4 max-w-3xl text-sm text-ember">The agent could not finish that answer.</p>}
          </div>
          <form
            className="px-4 pb-4 md:px-8"
            onSubmit={(event) => {
              event.preventDefault();
              ask(input);
            }}
          >
            <div className="glass mx-auto flex max-w-3xl items-end gap-2 rounded-3xl p-2">
              <label htmlFor="composer" className="sr-only">Ask DocMind</label>
              <textarea
                id="composer"
                data-testid="composer"
                value={input}
                rows={1}
                placeholder="Ask about your sources…"
                className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 outline-none"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    ask(input);
                  }
                }}
              />
              {busy ? (
                <button type="button" onClick={() => stop()} aria-label="Stop generating" className="grid size-11 place-items-center rounded-full bg-ink text-paper">
                  <Square aria-hidden className="size-4" />
                </button>
              ) : (
                <button type="submit" data-testid="send" aria-label="Send" disabled={!input.trim()} className="grid size-11 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-40">
                  <ArrowUp aria-hidden className="size-4" />
                </button>
              )}
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted">
              {demo ? "Demo mode quotes the retrieved sentence." : "Live model. Check every citation against the passage."} Enter sends.
            </p>
          </form>
        </main>
      </div>

      <AnimatePresence>
        {libraryOpen && (
          <motion.div className="fixed inset-0 z-40 bg-ink/40 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLibraryOpen(false)}>
            <motion.div
              data-testid="library-sheet"
              role="dialog"
              aria-label="Library"
              initial={reduce ? false : { x: -24 }}
              animate={{ x: 0 }}
              exit={{ x: -24 }}
              className="flex h-full w-full flex-col bg-[#f3efe6] dark:bg-[#100e0c]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex justify-end p-3">
                <button type="button" aria-label="Close library" onClick={() => setLibraryOpen(false)} className="grid size-9 place-items-center rounded-full border border-line">
                  <X aria-hidden className="size-4" />
                </button>
              </div>
              {library}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SourceDrawer citation={citation} onClose={() => setCitation(null)} />
      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onAdded={onRefresh} />
    </div>
  );
}

function AccessGate({ onUnlock }: { onUnlock: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (!response.ok) {
      setError("That access key is not right.");
      return;
    }
    onUnlock();
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="glass w-full max-w-md rounded-3xl p-6">
        <p className="font-serif text-4xl">DocMind is locked.</p>
        <p className="mt-2 text-muted">This deployment set an access key. The demo needs no key unless the owner configured one.</p>
        <label htmlFor="access-key" className="mt-5 block text-sm">Access key</label>
        <input id="access-key" type="password" value={key} onChange={(event) => setKey(event.target.value)} className="mt-2 w-full rounded-2xl border border-line bg-paper px-3 py-2" />
        {error && <p className="mt-2 text-sm text-ember">{error}</p>}
        <button type="submit" className="mt-4 rounded-full bg-accent px-4 py-2 font-semibold text-accent-ink">Unlock</button>
      </form>
    </main>
  );
}
