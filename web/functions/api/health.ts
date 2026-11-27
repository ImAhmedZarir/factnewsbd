import { jsonResponse } from "../lib/cf-edge";

export async function onRequestGet() {
  return jsonResponse({
    status: "ok",
    service: "factnews-bangladesh",
    runtime: "cloudflare-pages",
    timestamp: new Date().toISOString(),
  });
}
