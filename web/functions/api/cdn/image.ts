import { jsonResponse, verifyCdnImageTokenEdge, type PagesContext } from "../../lib/cf-edge";

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#141821"/>
      <stop offset="100%" stop-color="#1f2430"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect x="44" y="44" width="1112" height="587" fill="none" stroke="#31394a" stroke-width="2"/>
  <text x="600" y="322" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#f8fafc">FACTNEWS BANGLADESH</text>
  <text x="600" y="366" text-anchor="middle" font-family="system-ui, sans-serif" font-size="17" fill="#94a3b8">Verified Multi-Source Dispatch</text>
</svg>`;

export async function onRequestGet(context: PagesContext) {
  const url = new URL(context.request.url);
  const token = url.searchParams.get("t");
  if (!token) {
    return jsonResponse({ error: "Missing CDN image token" }, 400);
  }

  const targetUrl = await verifyCdnImageTokenEdge(token, context.env.CDN_SIGNING_SECRET);
  if (!targetUrl) {
    return jsonResponse({ error: "Invalid or tampered CDN token" }, 403);
  }

  const edgeCache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  if (edgeCache) {
    const cached = await edgeCache.match(cacheKey);
    if (cached) return cached;
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.startsWith("image/")) {
      return new Response(FALLBACK_SVG, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=1800",
          "X-CDN-Fallback": "upstream-unavailable",
        },
      });
    }

    const response = new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
    if (edgeCache) {
      context.waitUntil(edgeCache.put(cacheKey, response.clone()));
    }
    return response;
  } catch {
    return new Response(FALLBACK_SVG, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=600",
        "X-CDN-Fallback": "timeout",
      },
    });
  }
}
