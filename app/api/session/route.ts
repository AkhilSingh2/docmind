import { accessGranted } from "@/lib/auth";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const required = Boolean(getConfig().accessKey);
  return Response.json({ required, ok: !required || accessGranted(request) });
}

export async function POST(request: Request) {
  const expected = getConfig().accessKey;
  if (!expected) return Response.json({ ok: true, required: false });
  const body = (await request.json().catch(() => ({}))) as { key?: string };
  if (body.key !== expected) return Response.json({ error: "That access key is not right." }, { status: 401 });
  const response = Response.json({ ok: true, required: true });
  response.headers.set(
    "Set-Cookie",
    `docmind_key=${encodeURIComponent(expected)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`,
  );
  return response;
}
