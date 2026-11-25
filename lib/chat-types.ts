import type { UIMessage } from "ai";
import type { CitationData } from "@/lib/types";

export type DocMindMetadata = {
  mode: "mock" | "live";
  provider: string;
};

export type DocMindMessage = UIMessage<DocMindMetadata, { citation: CitationData }>;
