import { denied } from "@/lib/auth";
import { addDocument, listSummaries, titleFromMarkdown } from "@/lib/documents";
import { fetchPublicText } from "@/lib/ingest/fetch-url";
import { extractPdf } from "@/lib/ingest/pdf";
import { getStore } from "@/lib/store";
import type { SourceType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = denied(request);
  if (blocked) return blocked;
  const store = await getStore();
  return Response.json({ documents: await listSummaries(store) });
}

export async function POST(request: Request) {
  const blocked = denied(request);
  if (blocked) return blocked;
  const store = await getStore();
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return Response.json({ error: "Attach a PDF, Markdown, or text file." }, { status: 400 });
      if (file.size > 4_000_000) return Response.json({ error: "Files must be 4 MB or smaller." }, { status: 400 });
      const name = file.name || "upload";
      const lower = name.toLowerCase();
      let text = "";
      let sourceType: SourceType = "markdown";
      if (lower.endsWith(".pdf") || file.type === "application/pdf") {
        const extracted = await extractPdf(Buffer.from(await file.arrayBuffer()));
        text = extracted.text;
        sourceType = "pdf";
      } else if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt") || file.type.startsWith("text/")) {
        text = await file.text();
      } else {
        return Response.json({ error: "Upload a PDF, Markdown, or text file." }, { status: 400 });
      }
      const requested = String(form.get("title") ?? "").trim();
      const summary = await addDocument(store, {
        title: requested || titleFromMarkdown(text, name.replace(/\.[^.]+$/, "")),
        sourceType,
        sourceLabel: name,
        text,
      });
      return Response.json(summary, { status: 201 });
    }

    const body = (await request.json()) as { kind?: string; title?: string; text?: string; url?: string };
    if (body.kind === "url") {
      const fetched = await fetchPublicText(String(body.url ?? ""));
      const summary = await addDocument(store, {
        title: body.title?.trim() || fetched.title,
        sourceType: "url",
        sourceLabel: fetched.label,
        text: fetched.text,
      });
      return Response.json(summary, { status: 201 });
    }
    if (body.kind === "markdown") {
      const text = String(body.text ?? "");
      const summary = await addDocument(store, {
        title: body.title?.trim() || titleFromMarkdown(text, "Pasted note"),
        sourceType: "markdown",
        sourceLabel: "Pasted markdown",
        text,
      });
      return Response.json(summary, { status: 201 });
    }
    return Response.json({ error: "Send a file, a markdown note, or a URL." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not ingest that." }, { status: 400 });
  }
}
