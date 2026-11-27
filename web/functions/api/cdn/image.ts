import {
  fetchSafeExternalImage,
  jsonResponse,
  verifyCdnImageTokenEdge,
  type PagesContext,
} from "../../lib/cf-edge";

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

const SANDBOX_CSP = "default-src 'none'; script-src 'none'; style-src 'none'; sandbox";

export async function onRequestGet(context: PagesContext) {
  const url = new URL(context.request.url);
  const token = url.searchParams.get("t");
  if (!token) {
    return jsonResponse({ error: "Missing CDN image token" }, 400, true);
  }

  const targetUrl = await verifyCdnImageTokenEdge(token, context.env.CDN_SIGNING_SECRET);
  if (!targetUrl) {
    return jsonResponse({ error: "Invalid or tampered CDN token" }, 403, true);
  }

  const edgeCache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  if (edgeCache) {
    const cached = await edgeCache.match(cacheKey);
    if (cached) return cached;
  }

  try {
    const result = await fetchSafeExternalImage(targetUrl);
    if (!result.ok) {
      return new Response(FALLBACK_SVG, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=1800",
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
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
        "Content-Security-Policy": SANDBOX_CSP,
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
        "Content-Security-Policy": SANDBOX_CSP,
        "X-Content-Type-Options": "nosniff",
        "X-CDN-Fallback": "timeout",
      },
    });
  }
}
