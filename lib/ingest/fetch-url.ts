import { assertPublicHttpUrl } from "@/lib/ingest/url-guard";
import { htmlToText } from "@/lib/ingest/html";
import { titleFromMarkdown } from "@/lib/documents";

export async function fetchPublicText(raw: string): Promise<{ title: string; text: string; label: string }> {
  let current = await assertPublicHttpUrl(raw);
  for (let hop = 0; hop < 3; hop += 1) {
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The redirect had no destination.");
      current = await assertPublicHttpUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`The page returned ${response.status}.`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 1_500_000) throw new Error("That page is too large to ingest.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 1_500_000) throw new Error("That page is too large to ingest.");
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    const rawText = bytes.toString("utf8");
    if (type.includes("html") || rawText.trimStart().startsWith("<")) {
      const parsed = htmlToText(rawText);
      if (parsed.text.length < 20) throw new Error("That page did not contain enough text.");
      return { title: parsed.title ?? current.hostname, text: parsed.text, label: current.toString() };
    }
    return {
      title: titleFromMarkdown(rawText, current.hostname),
      text: rawText,
      label: current.toString(),
    };
  }
  throw new Error("Too many redirects.");
}
