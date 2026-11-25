import { lookup } from "node:dns/promises";

export function classifyHost(hostname: string): "public" | "blocked" {
  const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host) return "blocked";
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "0.0.0.0" || host === "::" || host === "::1") {
    return "blocked";
  }
  if (host.includes(":")) return classifyIpv6(host);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return classifyIpv4(host) ? "blocked" : "public";
  if (/^\d+$/.test(host)) return "blocked";
  return "public";
}

function classifyIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function classifyIpv6(host: string): "public" | "blocked" {
  const normalized = host.toLowerCase();
  if (normalized === "::1" || normalized === "::") return "blocked";
  if (normalized.startsWith("fe80") || normalized.startsWith("fc") || normalized.startsWith("fd")) return "blocked";
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (mapped.includes(".")) return classifyIpv4(mapped) ? "blocked" : "public";
  }
  return "public";
}

export type LookupFn = (hostname: string) => Promise<{ address: string }[]>;

async function defaultLookup(hostname: string): Promise<{ address: string }[]> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((result) => ({ address: result.address }));
}

export async function assertPublicHttpUrl(raw: string, resolve: LookupFn = defaultLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That does not look like a URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs can be ingested.");
  }
  if (url.username || url.password) throw new Error("URLs with credentials are blocked.");
  if (classifyHost(url.hostname) === "blocked") {
    throw new Error("That host is blocked so the ingester cannot reach local or private addresses.");
  }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) && !url.hostname.includes(":")) {
    let records: { address: string }[];
    try {
      records = await resolve(url.hostname);
    } catch {
      throw new Error("Could not resolve that hostname.");
    }
    if (!records.length || records.some((record) => classifyHost(record.address) === "blocked")) {
      throw new Error("That hostname resolves to a blocked address.");
    }
  }
  return url;
}
