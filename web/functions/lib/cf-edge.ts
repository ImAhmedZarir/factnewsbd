/**
 * Shared Cloudflare Pages Edge Utilities (WebCrypto + Supabase REST + HMAC CDN + PAT Auth)
 * Uses pure Web Standards — zero Node.js runtime dependency overhead.
 */

export interface PagesEnv {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CDN_SIGNING_SECRET?: string;
  INGEST_PAT_SECRET?: string;
  ADMIN_CONSOLE_SECRET?: string;
  CLOUDFLARE_DEPLOY_HOOK_URL?: string;
}

export interface PagesContext<E = PagesEnv> {
  request: Request;
  env: E;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  next: () => Promise<Response>;
}

const DEFAULT_CDN_SECRET = "bd-factnews-local-cdn-signing-secret-change-me";

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function getSupabaseConfig(env: PagesEnv): { url: string; serviceKey: string } | null {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToString(input: string): string {
  const padded =
    input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function stringToBase64Url(input: string): string {
  return bytesToBase64Url(new TextEncoder().encode(input));
}

export async function sha256Hex(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw.trim()));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function isSafeExternalUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    if (
      h === "localhost" ||
      h.endsWith(".local") ||
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      /^169\.254\./.test(h) ||
      h === "::1"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function signCdnPayload(payloadB64: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret || DEFAULT_CDN_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return bytesToBase64Url(new Uint8Array(sig)).slice(0, 22);
}

export async function buildCdnImageTokenEdge(
  rawUrl: string | null | undefined,
  secret?: string,
): Promise<string | null> {
  if (!rawUrl || !isSafeExternalUrl(rawUrl)) return null;
  const payloadB64 = stringToBase64Url(JSON.stringify({ u: rawUrl }));
  const sig = await signCdnPayload(payloadB64, secret || DEFAULT_CDN_SECRET);
  return `${payloadB64}.${sig}`;
}

export async function verifyCdnImageTokenEdge(
  token: string,
  secret?: string,
): Promise<string | null> {
  const clean = token.replace(/\.(webp|jpg|jpeg|png)$/i, "");
  const [payloadB64, sig] = clean.split(".");
  if (!payloadB64 || !sig) return null;

  const expected = await signCdnPayload(payloadB64, secret || DEFAULT_CDN_SECRET);
  if (!timingSafeEqualStr(sig, expected)) return null;

  try {
    const parsed = JSON.parse(base64UrlToString(payloadB64)) as { u?: string };
    if (!parsed.u || !isSafeExternalUrl(parsed.u)) return null;
    return parsed.u;
  } catch {
    return null;
  }
}

export interface VerifiedPat {
  id: string;
  label: string;
}

export async function verifyPatBearerEdge(
  authHeader: string | null,
  env: PagesEnv,
): Promise<{ ok: boolean; pat?: VerifiedPat; reason?: string }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, reason: "Missing Authorization: Bearer <PAT> header" };
  }
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken.startsWith("news_pat_") || rawToken.length < 24) {
    return { ok: false, reason: "Malformed PAT format" };
  }

  const incomingHash = await sha256Hex(rawToken);

  if (env.INGEST_PAT_SECRET) {
    const envHash = await sha256Hex(env.INGEST_PAT_SECRET);
    if (timingSafeEqualStr(incomingHash, envHash)) {
      return { ok: true, pat: { id: "pat_env_master", label: "Env Master Agent PAT" } };
    }
  }

  const sb = getSupabaseConfig(env);
  if (sb) {
    const queryUrl = `${sb.url}/rest/v1/pat_tokens?select=id,label&token_hash=eq.${incomingHash}&is_active=eq.true&limit=1`;
    const res = await fetch(queryUrl, {
      headers: {
        apikey: sb.serviceKey,
        Authorization: `Bearer ${sb.serviceKey}`,
      },
    });
    if (res.ok) {
      const rows = (await res.json()) as Array<{ id: string; label: string }>;
      const match = rows[0];
      if (match) {
        await fetch(`${sb.url}/rest/v1/pat_tokens?id=eq.${encodeURIComponent(match.id)}`, {
          method: "PATCH",
          headers: {
            apikey: sb.serviceKey,
            Authorization: `Bearer ${sb.serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ last_used_at: new Date().toISOString() }),
        }).catch(() => undefined);
        return { ok: true, pat: { id: match.id, label: match.label } };
      }
    }
  }

  return { ok: false, reason: "Invalid or revoked PAT" };
}
