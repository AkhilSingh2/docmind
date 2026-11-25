import { denied } from "@/lib/auth";
import { ensureSeed, listSummaries } from "@/lib/documents";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = denied(request);
  if (blocked) return blocked;
  const store = await getStore();
  await ensureSeed(store);
  return Response.json({ documents: await listSummaries(store) });
}
