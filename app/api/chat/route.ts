import { liveChatResponse } from "@/lib/agent/live";
import { mockChatResponse } from "@/lib/agent/mock-stream";
import { denied } from "@/lib/auth";
import type { DocMindMessage } from "@/lib/chat-types";
import { getConfig } from "@/lib/config";
import { latestUserText } from "@/lib/messages";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const blocked = denied(request);
  if (blocked) return blocked;
  const body = (await request.json()) as { messages?: DocMindMessage[]; documentIds?: unknown };
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const query = latestUserText(messages);
  if (!query) return Response.json({ error: "Write a question first." }, { status: 400 });
  const documentIds = Array.isArray(body.documentIds) ? body.documentIds.filter((id): id is string => typeof id === "string") : undefined;

  try {
    const store = await getStore();
    if (getConfig().llmProvider === "mock") return mockChatResponse(query, store, documentIds);
    return liveChatResponse(messages, store, documentIds);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The agent failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
