import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Route all images through our signed Image CDN wrapper (/api/cdn/image or external Cloudflare Worker)
    // so Cloudflare Pages / Workers incur zero Next image optimization overhead.
    unoptimized: true,
  },
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ],
};

export default nextConfig;
