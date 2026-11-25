"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatScore } from "@/lib/rag/text";
import type { ChunkView, CitationData } from "@/lib/types";

type Loaded = {
  title: string;
  sourceLabel: string;
  chunks: ChunkView[];
};

function Highlighted({ content, excerpt }: { content: string; excerpt: string }) {
  const index = content.indexOf(excerpt);
  if (index < 0) return <>{content}</>;
  return (
    <>
      {content.slice(0, index)}
      <mark className="mark">{excerpt}</mark>
      {content.slice(index + excerpt.length)}
    </>
  );
}

export function SourceDrawer({ citation, onClose }: { citation: CitationData | null; onClose: () => void }) {
  const [request, setRequest] = useState<{ chunkId: string; loaded: Loaded | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!citation) return;
    const controller = new AbortController();
    const chunkId = citation.chunkId;
    fetch(`/api/documents/${citation.documentId}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not open that source.");
        return (await response.json()) as Loaded;
      })
      .then((payload) => {
        if (!controller.signal.aborted) setRequest({ chunkId, loaded: payload, error: null });
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setRequest({
          chunkId,
          loaded: null,
          error: reason instanceof Error ? reason.message : "Could not open that source.",
        });
      });
    return () => controller.abort();
  }, [citation]);

  const current = citation && request && request.chunkId === citation.chunkId ? request : null;
  const loaded = current?.loaded ?? null;
  const error = current?.error ?? null;

  useEffect(() => {
    if (!citation || !loaded) return;
    document.getElementById(`chunk-${citation.chunkId}`)?.scrollIntoView({ block: "center" });
  }, [citation, loaded]);

  useEffect(() => {
    if (!citation) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [citation, onClose]);

  if (!citation) return null;

  return (
    <aside data-testid="source-drawer" role="dialog" aria-modal="true" aria-label="Source passage" className="glass fixed inset-x-0 bottom-0 z-40 flex max-h-[78dvh] flex-col rounded-t-3xl shadow-2xl md:inset-y-auto md:top-[73px] md:bottom-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-y-0 md:border-r-0">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-ember uppercase">Source {citation.index}</p>
          <h2 className="mt-1 font-serif text-2xl leading-tight">{citation.documentTitle}</h2>
          <p className="mt-1 text-sm text-muted">{citation.heading ?? "Passage"} · match {formatScore(citation.score)}</p>
        </div>
        <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full border border-line" aria-label="Close source">
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {error && <p className="text-sm text-ember">{error}</p>}
        {(loaded?.chunks ?? []).map((chunk) => (
          <article key={chunk.id} id={`chunk-${chunk.id}`} className={chunk.id === citation.chunkId ? "rounded-2xl bg-panel p-3 ring-1 ring-ember/50" : "rounded-2xl p-3 text-muted"}>
            {chunk.heading && <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{chunk.heading}</p>}
            <p className="whitespace-pre-wrap text-sm leading-6">
              {chunk.id === citation.chunkId ? <Highlighted content={chunk.content} excerpt={citation.excerpt} /> : chunk.content}
            </p>
          </article>
        ))}
        {!loaded && !error && <p className="text-sm text-muted">Opening the passage…</p>}
      </div>
    </aside>
  );
}
