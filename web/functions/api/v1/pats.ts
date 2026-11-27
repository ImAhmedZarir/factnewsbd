import {
  bytesToBase64Url,
  getSupabaseConfig,
  jsonResponse,
  sha256Hex,
  timingSafeEqualStr,
  type PagesContext,
} from "../../lib/cf-edge";

function isAuthorizedAdmin(request: Request, configuredSecret?: string): boolean {
  if (!configuredSecret || configuredSecret.length < 16) return false;
  const auth = request.headers.get("authorization");
  const headerSecret =
    request.headers.get("x-admin-secret") ||
    (auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "");
  return timingSafeEqualStr(headerSecret, configuredSecret);
}

export async function onRequestGet(context: PagesContext) {
  if (!isAuthorizedAdmin(context.request, context.env.ADMIN_CONSOLE_SECRET)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }
  const sb = getSupabaseConfig(context.env);
  if (!sb) return jsonResponse({ tokens: [] });
  const res = await fetch(
    `${sb.url}/rest/v1/pat_tokens?select=id,label,token_prefix,scopes,is_active,last_used_at,created_at&order=created_at.desc`,
    {
      headers: { apikey: sb.serviceKey, Authorization: `Bearer ${sb.serviceKey}` },
    },
  );
  const tokens = res.ok ? await res.json() : [];
  return jsonResponse({ tokens });
}

export async function onRequestPost(context: PagesContext) {
  if (!isAuthorizedAdmin(context.request, context.env.ADMIN_CONSOLE_SECRET)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }
  const sb = getSupabaseConfig(context.env);
  if (!sb) return jsonResponse({ error: "Supabase not configured" }, 500);

  const body = (await context.request.json().catch(() => ({}))) as {
    label?: string;
    scopes?: string[];
  };
  const rand = crypto.getRandomValues(new Uint8Array(24));
  const rawToken = `news_pat_${bytesToBase64Url(rand)}`;
  const tokenHash = await sha256Hex(rawToken);
  const label = (body.label || "BD Scraper Agent").trim();

  const res = await fetch(`${sb.url}/rest/v1/pat_tokens`, {
    method: "POST",
    headers: {
      apikey: sb.serviceKey,
      Authorization: `Bearer ${sb.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      label,
      token_prefix: rawToken.slice(0, 16),
      token_hash: tokenHash,
      scopes: body.scopes?.length ? body.scopes : ["news:write", "revalidate"],
      is_active: true,
    }),
  });
  const rows = res.ok ? await res.json() : [];
  return jsonResponse({ rawToken, record: Array.isArray(rows) ? rows[0] : null }, 201);
}

export async function onRequestDelete(context: PagesContext) {
  if (!isAuthorizedAdmin(context.request, context.env.ADMIN_CONSOLE_SECRET)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }
  const sb = getSupabaseConfig(context.env);
  if (!sb) return jsonResponse({ error: "Supabase not configured" }, 500);
  const id = new URL(context.request.url).searchParams.get("id");
  if (!id) return jsonResponse({ error: "Missing id" }, 400);

  const res = await fetch(`${sb.url}/rest/v1/pat_tokens?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: sb.serviceKey,
      Authorization: `Bearer ${sb.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ is_active: false }),
  });
  return jsonResponse({ ok: res.ok });
}
