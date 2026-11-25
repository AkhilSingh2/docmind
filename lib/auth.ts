import { getConfig } from "@/lib/config";

function cookieValue(header: string | null): string {
  if (!header) return "";
  const found = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("docmind_key="));
  if (!found) return "";
  try {
    return decodeURIComponent(found.slice("docmind_key=".length));
  } catch {
    return "";
  }
}

export function accessGranted(request: Request): boolean {
  const key = getConfig().accessKey;
  if (!key) return true;
  if (request.headers.get("x-docmind-key") === key) return true;
  return cookieValue(request.headers.get("cookie")) === key;
}

export function denied(request: Request): Response | null {
  if (accessGranted(request)) return null;
  return Response.json({ error: "This DocMind instance requires an access key." }, { status: 401 });
}
