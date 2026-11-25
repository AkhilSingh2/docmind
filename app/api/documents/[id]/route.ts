import { denied } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const blocked = denied(request);
  if (blocked) return blocked;
  const { id } = await context.params;
  const document = await (await getStore()).getDocument(id);
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });
  return Response.json(document);
}

export async function DELETE(request: Request, context: Context) {
  const blocked = denied(request);
  if (blocked) return blocked;
  const { id } = await context.params;
  const removed = await (await getStore()).deleteDocument(id);
  if (!removed) return Response.json({ error: "Document not found." }, { status: 404 });
  return Response.json({ ok: true });
}
