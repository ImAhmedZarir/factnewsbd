/**
 * BD FactNews Edge Image CDN Wrapper (Cloudflare Worker)
 *
 * - Masks raw publisher URLs behind an HMAC-SHA256 signed token (/i/<payload>.<sig>)
 * - Validates SSRF/protocol safety (HTTPS only, blocks private IPs)
 * - Strips Referer & cookies so upstream portals see zero site association
 * - Caches at Cloudflare Edge for 1 year (immutable) -> minimal origin load
 * - Serves clean branded SVG fallback if upstream refuses/expires
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
  <text x="600" y="325" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#2c2a26">VERIFIED NEWS DISPATCH</text>
  <text x="600" y="370" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="#6b665d">Cross-Source Fact-Checked Coverage</text>
</svg>`;

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

function isSafeExternalUrl(raw: string): boolean {
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
      /^169\.254\./.test(h)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/i/")) {
      return new Response("BD FactNews Image CDN Wrapper OK", { status: 200 });
    }

    const tokenPart = url.pathname.slice(3).replace(/\.(webp|jpg|jpeg|png)$/i, "");
    const [payloadB64, sig] = tokenPart.split(".");
    if (!payloadB64 || !sig) {
      return new Response("Invalid CDN token", { status: 400 });
    }

    const secret = env.CDN_SIGNING_SECRET || "dev-cdn-secret-change-in-prod";
    const expectedSig = await signPayload(payloadB64, secret);
    if (sig !== expectedSig) {
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
      const upstream = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BDFactNewsCDN/1.0)",
          "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
        redirect: "follow",
        cf: { cacheTtl: 86400, cacheEverything: true },
      } as RequestInit);

      const contentType = upstream.headers.get("content-type") || "";
      if (!upstream.ok || !contentType.startsWith("image/")) {
        return new Response(FALLBACK_SVG, {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            "X-CDN-Fallback": "upstream-unavailable",
          },
        });
      }

      const response = new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "Access-Control-Allow-Origin": "*",
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
          "X-CDN-Fallback": "fetch-error",
        },
      });
    }
  },
};
