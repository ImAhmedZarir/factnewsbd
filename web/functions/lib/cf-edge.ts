/**
 * Shared Cloudflare Pages Edge Utilities (WebCrypto + Supabase REST + Hardened SSRF + PAT Auth)
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
const ALLOWED_RASTER_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function jsonResponse(body: unknown, status = 200, noStore = false): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
  if (noStore) {
    headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
  }
  return new Response(JSON.stringify(body), { status, headers });
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
    if (u.username || u.password) return false;
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!h || !h.includes(".") || /^\d+$/.test(h)) return false;
    if (
      h === "localhost" ||
      h.endsWith(".local") ||
      h.endsWith(".internal") ||
      h.endsWith(".localhost") ||
      h.startsWith("0.") ||
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      /^169\.254\./.test(h) ||
      /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(h) ||
      h === "::1" ||
      h === "::" ||
      h.startsWith("::ffff:") ||
      h.startsWith("fe80:") ||
      h.startsWith("fc") ||
      h.startsWith("fd")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function fetchSafeExternalImage(
  initialUrl: string,
): Promise<{ ok: true; contentType: string; body: ArrayBuffer } | { ok: false }> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= 3; hop += 1) {
    if (!isSafeExternalUrl(currentUrl)) return { ok: false };

    const upstream = await fetch(currentUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "image/jpeg,image/png,image/webp;q=0.9,image/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location) return { ok: false };
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!upstream.ok) return { ok: false };

    const rawMime = (upstream.headers.get("content-type") || "").split(";")[0]?.trim().toLowerCase() || "";
    if (!ALLOWED_RASTER_TYPES.has(rawMime)) {
      return { ok: false };
    }

    const declaredLen = Number(upstream.headers.get("content-length") || "0");
    if (declaredLen > MAX_IMAGE_BYTES) {
      return { ok: false };
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
      return { ok: false };
    }

    return { ok: true, contentType: rawMime, body: buffer };
  }

  return { ok: false };
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
