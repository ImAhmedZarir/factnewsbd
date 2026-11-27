import { jsonResponse, type PagesContext } from "../lib/cf-edge";

export async function onRequestGet(context: PagesContext) {
  return jsonResponse({
    status: "ok",
    service: "factnews-bangladesh",
    runtime: "cloudflare-pages",
    supabase_configured: Boolean(
      context.env.SUPABASE_URL || context.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    timestamp: new Date().toISOString(),
  });
}
