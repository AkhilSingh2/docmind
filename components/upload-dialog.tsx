"use client";

import { X } from "lucide-react";
import { useState } from "react";

type Tab = "file" | "paste" | "url";

export function UploadDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [tab, setTab] = useState<Tab>("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let response: Response;
      if (tab === "file") {
        const form = new FormData(event.currentTarget);
        response = await fetch("/api/documents", { method: "POST", body: form });
      } else if (tab === "url") {
        response = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "url", url, title }),
        });
      } else {
        response = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "markdown", text, title }),
        });
      }
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not add that source.");
      setTitle("");
      setText("");
      setUrl("");
      onAdded();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add that source.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="presentation" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
        className="glass w-full max-w-lg rounded-3xl p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="upload-title" className="font-serif text-3xl">Add a source</h2>
            <p className="mt-1 text-sm text-muted">PDF, Markdown, a pasted note, or a public URL.</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full border border-line" aria-label="Close add source">
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="mt-4 flex gap-2" role="tablist">
          {(["file", "paste", "url"] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={tab === item ? "rounded-full bg-ink px-3 py-1.5 text-sm text-paper" : "rounded-full border border-line px-3 py-1.5 text-sm"}>
              {item === "file" ? "File" : item === "paste" ? "Paste" : "URL"}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {tab === "file" && <input name="file" type="file" accept=".pdf,.md,.markdown,.txt,text/plain,text/markdown,application/pdf" required className="block w-full text-sm" />}
          {tab !== "file" && (
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title (optional)" className="w-full rounded-2xl border border-line bg-paper px-3 py-2" />
          )}
          {tab === "paste" && (
            <textarea value={text} onChange={(event) => setText(event.target.value)} required minLength={20} rows={8} placeholder="Paste markdown…" className="w-full rounded-2xl border border-line bg-paper px-3 py-2" />
          )}
          {tab === "url" && (
            <input value={url} onChange={(event) => setUrl(event.target.value)} required type="url" placeholder="https://example.com/notes" className="w-full rounded-2xl border border-line bg-paper px-3 py-2" />
          )}
          {error && <p className="text-sm text-ember">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={busy} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60">
            {busy ? "Indexing…" : "Index source"}
          </button>
        </div>
      </form>
    </div>
  );
}
