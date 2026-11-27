import crypto from "node:crypto";

const CDN_SECRET = process.env.CDN_SIGNING_SECRET || "";

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export function isSafeExternalImageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || !host.includes(".") || /^\d+$/.test(host)) return false;
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.endsWith(".localhost") ||
      host.startsWith("0.") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(host) ||
      host === "::1" ||
      host === "::" ||
      host.startsWith("::ffff:") ||
      host.startsWith("fe80:") ||
      host.startsWith("fc") ||
      host.startsWith("fd")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function signPayload(payloadB64: string): string {
  return crypto
    .createHmac("sha256", CDN_SECRET)
    .update(payloadB64)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
    .slice(0, 22);
}

/**
 * Generates an opaque, HMAC-signed CDN token and URL so raw publisher domains
 * are never exposed in <img src> or HTML markup.
 */
export function buildCdnImageToken(rawImageUrl: string | null | undefined): string | null {
  if (!CDN_SECRET || !rawImageUrl || !isSafeExternalImageUrl(rawImageUrl)) return null;
  const payloadB64 = toBase64Url(JSON.stringify({ u: rawImageUrl }));
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function buildCdnImageUrl(rawImageUrl: string | null | undefined): string | null {
  const token = buildCdnImageToken(rawImageUrl);
  if (!token) return null;

  const externalCdnBase = process.env.NEXT_PUBLIC_CDN_BASE_URL?.replace(/\/$/, "");
  if (externalCdnBase) {
    return `${externalCdnBase}/i/${token}.webp`;
  }
  return `/api/cdn/image?t=${encodeURIComponent(token)}`;
}

export function verifyCdnImageToken(token: string): string | null {
  if (!CDN_SECRET) return null;
  const clean = token.replace(/\.(webp|jpg|jpeg|png)$/i, "");
  const [payloadB64, sig] = clean.split(".");
  if (!payloadB64 || !sig) return null;

  const expected = signPayload(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payloadB64)) as { u?: string };
    if (!parsed.u || !isSafeExternalImageUrl(parsed.u)) return null;
    return parsed.u;
  } catch {
    return null;
  }
}
