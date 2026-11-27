import {
  bytesToBase64Url,
  getSupabaseConfig,
  jsonResponse,
  sha256Hex,
  timingSafeEqualDigest,
  type PagesContext,
} from "../../lib/cf-edge";

const ALLOWED_SCOPES = new Set(["news:write", "factcheck:write", "revalidate"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function isAuthorizedAdmin(request: Request, configuredSecret?: string): Promise<boolean> {
  if (!configuredSecret || configuredSecret.length < 16) return false;
  const auth = request.headers.get("authorization");
  const headerSecret =
    request.headers.get("x-admin-secret") ||
    (auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "");
  return timingSafeEqualDigest(headerSecret, configuredSecret);
}

export async function onRequestGet(context: PagesContext) {
  if (!(await isAuthorizedAdmin(context.request, context.env.ADMIN_CONSOLE_SECRET))) {
    return jsonResponse({ error: "Forbidden" }, 403, true);
  }
  const sb = getSupabaseConfig(context.env);
  if (!sb) return jsonResponse({ tokens: [] }, 200, true);
  const res = await fetch(
    `${sb.url}/rest/v1/pat_tokens?select=id,label,token_prefix,scopes,is_active,last_used_at,created_at&order=created_at.desc`,
    {
      headers: { apikey: sb.serviceKey, Authorization: `Bearer ${sb.serviceKey}` },
    },
  );
  if (!res.ok) return jsonResponse({ error: "Database query failed" }, 502, true);
  const tokens = await res.json();
  return jsonResponse({ tokens }, 200, true);
}

export async function onRequestPost(context: PagesContext) {
  if (!(await isAuthorizedAdmin(context.request, context.env.ADMIN_CONSOLE_SECRET))) {
    return jsonResponse({ error: "Forbidden" }, 403, true);
  }
  const sb = getSupabaseConfig(context.env);
  if (!sb) return jsonResponse({ error: "Supabase not configured" }, 500, true);

  const body = (await context.request.json().catch(() => ({}))) as {
    label?: string;
    scopes?: string[];
  };
  const cleanLabel = String(body.label || "BD Scraper Agent")
    .replace(/[\r\n<>]/g, "")
    .trim()
    .slice(0, 80);
  if (!cleanLabel) {
    return jsonResponse({ error: "Invalid token label" }, 400, true);
  }

  const requestedScopes = Array.isArray(body.scopes)
    ? body.scopes.filter((s) => typeof s === "string" && ALLOWED_SCOPES.has(s))
    : [];
  const finalScopes = requestedScopes.length > 0 ? requestedScopes : ["news:write", "revalidate"];

  const rand = crypto.getRandomValues(new Uint8Array(24));
  const rawToken = `news_pat_${bytesToBase64Url(rand)}`;
  const tokenHash = await sha256Hex(rawToken);

  const res = await fetch(`${sb.url}/rest/v1/pat_tokens`, {
    method: "POST",
    headers: {
      apikey: sb.serviceKey,
      Authorization: `Bearer ${sb.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      label: cleanLabel,
      token_prefix: rawToken.slice(0, 16),
      token_hash: tokenHash,
      scopes: finalScopes,
      is_active: true,
    }),
  });
  if (!res.ok) {
    return jsonResponse({ error: "Failed to persist token" }, 502, true);
  }
  const rows = (await res.json()) as Array<{
    id: string;
    label: string;
    token_prefix: string;
    scopes: string[];
    is_active: boolean;
    created_at: string;
  }>;
  return jsonResponse({ rawToken, record: rows[0] ?? null }, 201, true);
}

export async function onRequestDelete(context: PagesContext) {
  if (!(await isAuthorizedAdmin(context.request, context.env.ADMIN_CONSOLE_SECRET))) {
    return jsonResponse({ error: "Forbidden" }, 403, true);
  }
  const sb = getSupabaseConfig(context.env);
  if (!sb) return jsonResponse({ error: "Supabase not configured" }, 500, true);
  const id = new URL(context.request.url).searchParams.get("id");
  if (!id || !UUID_RE.test(id)) return jsonResponse({ error: "Invalid PAT id" }, 400, true);

  const res = await fetch(`${sb.url}/rest/v1/pat_tokens?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: sb.serviceKey,
      Authorization: `Bearer ${sb.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ is_active: false }),
  });
  return jsonResponse({ ok: res.ok }, res.ok ? 200 : 502, true);
}
