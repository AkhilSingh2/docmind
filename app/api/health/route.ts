import { getConfig } from "@/lib/config";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getConfig();
  try {
    const store = await getStore();
    const counts = await store.counts();
    return Response.json({
      ok: true,
      provider: config.llmProvider,
      mode: config.llmProvider === "mock" ? "mock" : "live",
      store: store.kind,
      documents: counts.documents,
      chunks: counts.chunks,
      authRequired: Boolean(config.accessKey),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        provider: config.llmProvider,
        mode: config.llmProvider === "mock" ? "mock" : "live",
        store: config.vectorStore,
        authRequired: Boolean(config.accessKey),
        error: error instanceof Error ? error.message : "DocMind failed to start.",
      },
      { status: 500 },
    );
  }
}
