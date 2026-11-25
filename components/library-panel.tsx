"use client";

import { FileText, Globe, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DocumentSummary, SourceType } from "@/lib/types";

const LABELS: Record<SourceType, string> = {
  seed: "Sample",
  markdown: "Note",
  pdf: "PDF",
  url: "Web",
};

function Icon({ type }: { type: SourceType }) {
  if (type === "url") return <Globe aria-hidden className="size-3.5" />;
  return <FileText aria-hidden className="size-3.5" />;
}

export function LibraryPanel({
  documents,
  selected,
  onToggle,
  onClear,
  onUpload,
  onRestore,
  onDelete,
  className,
}: {
  documents: DocumentSummary[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  onUpload: () => void;
  onRestore: () => void;
  onDelete: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Library</p>
          <p className="mt-1 text-sm text-muted">{selected.length ? `${selected.length} in scope` : "Searching everything"}</p>
        </div>
        <button type="button" onClick={onUpload} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
          <Plus aria-hidden className="size-4" />
          Add
        </button>
      </div>
      {selected.length > 0 && (
        <button type="button" onClick={onClear} className="mx-4 mb-2 text-left text-sm text-accent">
          Clear source filter
        </button>
      )}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3" data-testid="library-list">
        {documents.map((document) => {
          const active = selected.includes(document.id);
          return (
            <div key={document.id} className={cn("rounded-2xl border p-3 transition", active ? "border-accent bg-accent/10" : "border-line")} style={active ? undefined : { backgroundColor: "var(--paper)" }}>
              <button type="button" onClick={() => onToggle(document.id)} className="w-full text-left" aria-pressed={active}>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Icon type={document.sourceType} />
                  {LABELS[document.sourceType]} · {document.chunkCount} passages
                </span>
                <span className="mt-1 block font-serif text-lg leading-snug">{document.title}</span>
              </button>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => onDelete(document.id)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted hover:text-ember"
                  aria-label={`Remove ${document.title}`}
                >
                  <Trash2 aria-hidden className="size-3.5" />
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        {!documents.length && <p className="px-2 py-6 text-sm text-muted">The library is empty. Add a note or restore the samples.</p>}
      </div>
      <div className="border-t border-line p-3">
        <button type="button" onClick={onRestore} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted hover:text-ink">
          <RotateCcw aria-hidden className="size-4" />
          Restore sample library
        </button>
      </div>
    </div>
  );
}
