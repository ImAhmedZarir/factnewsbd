/**
 * BD FactNews Edge Image CDN Wrapper (Cloudflare Worker)
 * Hardened against SSRF (manual redirect check + IPv6/CGNAT block), SVG XSS, and large-body DoS.
 */

export interface Env {
  CDN_SIGNING_SECRET: string;
}

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f4f2ee"/>
      <stop offset="100%" stop-color="#e5e1d8"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <rect x="48" y="48" width="1104" height="579" fill="none" stroke="#c8c2b6" stroke-width="2"/>
  <text x="600" y="325" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#2c2a26">FACTNEWS BANGLADESH</text>
  <text x="600" y="370" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="#6b665d">Verified Cross-Source Coverage</text>
</svg>`;

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
const SANDBOX_CSP = "default-src 'none'; script-src 'none'; style-src 'none'; sandbox";

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signPayload(payloadB64: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return bytesToBase64Url(new Uint8Array(sig)).slice(0, 22);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isSafeExternalUrl(raw: string): boolean {
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

async function fetchSafeImage(initialUrl: string): Promise<{ ok: true; contentType: string; body: ArrayBuffer } | { ok: false }> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop <= 3; hop += 1) {
    if (!isSafeExternalUrl(currentUrl)) return { ok: false };
    const upstream = await fetch(currentUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FactNewsBDCdn/1.2)",
        Accept: "image/jpeg,image/png,image/webp;q=0.9,image/*;q=0.5",
      },
      redirect: "manual",
      cf: { cacheTtl: 86400, cacheEverything: true },
    } as RequestInit);

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location) return { ok: false };
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!upstream.ok) return { ok: false };
    const rawMime = (upstream.headers.get("content-type") || "").split(";")[0]?.trim().toLowerCase() || "";
    if (!ALLOWED_RASTER_TYPES.has(rawMime)) return { ok: false };

    const declaredLen = Number(upstream.headers.get("content-length") || "0");
    if (declaredLen > MAX_IMAGE_BYTES) return { ok: false };

    const body = await upstream.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_IMAGE_BYTES) return { ok: false };
    return { ok: true, contentType: rawMime, body };
  }
  return { ok: false };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/i/")) {
      return new Response("BD FactNews Image CDN Wrapper OK", {
        status: 200,
        headers: { "X-Content-Type-Options": "nosniff" },
      });
    }

    const tokenPart = url.pathname.slice(3).replace(/\.(webp|jpg|jpeg|png)$/i, "");
    const [payloadB64, sig] = tokenPart.split(".");
    if (!payloadB64 || !sig) {
      return new Response("Invalid CDN token", { status: 400 });
    }

    const secret = env.CDN_SIGNING_SECRET || "bd-factnews-local-cdn-signing-secret-change-me";
    const expectedSig = await signPayload(payloadB64, secret);
    if (!timingSafeEqualStr(sig, expectedSig)) {
      return new Response("Forbidden: signature mismatch", { status: 403 });
    }

    let targetUrl = "";
    try {
      const decoded = new TextDecoder().decode(base64UrlToBytes(payloadB64));
      const parsed = JSON.parse(decoded) as { u: string };
      targetUrl = parsed.u;
    } catch {
      return new Response("Malformed payload", { status: 400 });
    }

    if (!isSafeExternalUrl(targetUrl)) {
      return new Response("Blocked URL", { status: 400 });
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    try {
      const result = await fetchSafeImage(targetUrl);
      if (!result.ok) {
        return new Response(FALLBACK_SVG, {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            "Content-Security-Policy": SANDBOX_CSP,
            "X-Content-Type-Options": "nosniff",
            "X-CDN-Fallback": "upstream-unavailable",
          },
        });
      }

      const response = new Response(result.body, {
        status: 200,
        headers: {
          "Content-Type": result.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Security-Policy": SANDBOX_CSP,
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "Access-Control-Allow-Origin": "https://factnewsbangladesh.bond",
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch {
      return new Response(FALLBACK_SVG, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          "Content-Security-Policy": SANDBOX_CSP,
          "X-Content-Type-Options": "nosniff",
          "X-CDN-Fallback": "fetch-error",
        },
      });
    }
  },
};
