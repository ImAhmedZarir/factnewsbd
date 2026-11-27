import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    // Route all images through signed Edge Image CDN (/api/cdn/image or cdn.factnewsbangladesh.bond)
    // so Cloudflare Pages incurs zero external image optimizer overhead and unlimited static bandwidth.
    unoptimized: true,
  },
  poweredByHeader: false,
};

export default nextConfig;
