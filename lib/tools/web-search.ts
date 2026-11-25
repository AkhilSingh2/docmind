export type WebResult = {
  title: string;
  snippet: string;
  url?: string;
};

export type WebSearchOutput = {
  query: string;
  source: "duckduckgo" | "offline";
  note: string;
  results: WebResult[];
};

type InstantAnswer = {
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
  RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
};

const OFFLINE: WebResult[] = [
  {
    title: "Offline briefing",
    snippet: "Live web search did not return an abstract. DocMind will not invent news. Ask the library, or retry when DuckDuckGo Instant Answers is reachable.",
  },
];

function fromInstant(query: string, payload: InstantAnswer): WebSearchOutput | null {
  const results: WebResult[] = [];
  if (payload.AbstractText) {
    results.push({
      title: payload.Heading || query,
      snippet: payload.AbstractText,
      url: payload.AbstractURL || undefined,
    });
  }
  const topics = payload.RelatedTopics ?? [];
  for (const topic of topics) {
    if (topic.Text && topic.FirstURL) {
      results.push({ title: topic.Text.slice(0, 80), snippet: topic.Text, url: topic.FirstURL });
    }
    for (const nested of topic.Topics ?? []) {
      if (nested.Text && nested.FirstURL) {
        results.push({ title: nested.Text.slice(0, 80), snippet: nested.Text, url: nested.FirstURL });
      }
    }
    if (results.length >= 4) break;
  }
  if (!results.length) return null;
  return {
    query,
    source: "duckduckgo",
    note: "These snippets came from DuckDuckGo Instant Answers, not from the document library.",
    results: results.slice(0, 4),
  };
}

export async function webSearch(query: string, fetcher: typeof fetch = fetch): Promise<WebSearchOutput> {
  const trimmed = query.trim();
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(trimmed)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetcher(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const payload = (await response.json()) as InstantAnswer;
    const parsed = fromInstant(trimmed, payload);
    if (parsed) return parsed;
  } catch {
    // Fall through to the honest offline briefing.
  }
  return {
    query: trimmed,
    source: "offline",
    note: "No live abstract came back. This is an offline notice, not a web result.",
    results: OFFLINE,
  };
}
