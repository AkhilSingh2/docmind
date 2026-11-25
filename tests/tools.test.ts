import { describe, expect, it } from "vitest";
import { routeIntent } from "@/lib/agent/intent";
import { CalculatorError, evaluateExpression, formatNumber } from "@/lib/tools/calculator";
import { htmlToText } from "@/lib/ingest/html";
import { extractPdfLiterals } from "@/lib/ingest/pdf";
import { classifyHost } from "@/lib/ingest/url-guard";
import { webSearch } from "@/lib/tools/web-search";

describe("calculator", () => {
  it("evaluates arithmetic, powers, functions, and percent", () => {
    expect(evaluateExpression("(12 + 8) * 3")).toBe(60);
    expect(evaluateExpression("2^10")).toBe(1024);
    expect(evaluateExpression("sqrt(81)")).toBe(9);
    expect(evaluateExpression("200 * 10%")).toBe(20);
    expect(formatNumber(1 / 4)).toBe("0.25");
  });

  it("rejects words and division by zero", () => {
    expect(() => evaluateExpression("2 + tax")).toThrow(CalculatorError);
    expect(() => evaluateExpression("4 / 0")).toThrow(/zero/i);
  });
});

describe("intent router", () => {
  it("sends arithmetic, comparison, summary, and web requests to tools", () => {
    expect(routeIntent("Calculate (12 + 8) * 3").type).toBe("calculate");
    expect(routeIntent("Compare the local vector store with pgvector").type).toBe("compare");
    expect(routeIntent("Summarise the evaluation notes").type).toBe("summarise");
    expect(routeIntent("Search the web for pgvector").type).toBe("web");
    expect(routeIntent("Why do we overlap chunks before embedding them?").type).toBe("retrieve");
  });
});

describe("ingest guards", () => {
  it("blocks private hosts and allows public names", () => {
    for (const host of ["localhost", "127.0.0.1", "10.1.2.3", "192.168.0.8", "169.254.169.254", "::1", "metadata.local"]) {
      expect(classifyHost(host)).toBe("blocked");
    }
    expect(classifyHost("example.com")).toBe("public");
    expect(classifyHost("1.1.1.1")).toBe("public");
  });

  it("extracts readable text from html and simple pdf literals", () => {
    const html = htmlToText("<html><title>Field notes</title><style>body{}</style><p>Overlap keeps context.</p><script>alert(1)</script></html>");
    expect(html.title).toBe("Field notes");
    expect(html.text).toContain("Overlap keeps context.");
    expect(html.text).not.toContain("alert");
    const pdf = Buffer.from("BT (DocMind overlap keeps context.) Tj ET");
    expect(extractPdfLiterals(pdf)).toContain("DocMind overlap keeps context.");
  });
});

describe("web search", () => {
  it("uses a live abstract when the fetcher returns one", async () => {
    const fetcher = (async () =>
      new Response(JSON.stringify({ Heading: "Pgvector", AbstractText: "An extension for vector similarity.", AbstractURL: "https://github.com/pgvector/pgvector" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    const result = await webSearch("pgvector", fetcher);
    expect(result.source).toBe("duckduckgo");
    expect(result.results[0].snippet).toContain("vector similarity");
  });

  it("does not invent a result when the lookup fails", async () => {
    const fetcher = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const result = await webSearch("latest news", fetcher);
    expect(result.source).toBe("offline");
    expect(result.note.toLowerCase()).toContain("not a web result");
  });
});
