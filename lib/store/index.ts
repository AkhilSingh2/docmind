import path from "node:path";
import { getConfig } from "@/lib/config";
import { ensureSeed } from "@/lib/documents";
import { LocalVectorStore } from "@/lib/store/local";
import type { VectorStore } from "@/lib/store/types";

let storePromise: Promise<VectorStore> | null = null;

export function getStore(): Promise<VectorStore> {
  if (!storePromise) {
    storePromise = openStore().catch((error) => {
      storePromise = null;
      throw error;
    });
  }
  return storePromise;
}

async function openStore(): Promise<VectorStore> {
  const config = getConfig();
  if (config.vectorStore === "pgvector") {
    const { PgVectorStore } = await import("@/lib/store/pg");
    const store = new PgVectorStore();
    await store.ready();
    await ensureSeed(store);
    return store;
  }
  const store = new LocalVectorStore(path.join(process.cwd(), config.dataDir, "store.json"));
  await store.load();
  await ensureSeed(store);
  return store;
}

export function resetStoreForTests(): void {
  storePromise = null;
}
