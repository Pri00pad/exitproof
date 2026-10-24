import type { NextConfig } from "next";

// cacheComponents / partialPrefetching are intentionally off: every employee
// page reads the Supabase session cookie and route params, and the classic
// request-time rendering model is simpler for this MVP.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Dev-only request log: never print verification tokens (they are in the path).
  logging: {
    incomingRequests: { ignore: [/\/verify\//] },
  },
  async headers() {
    return [
      {
        // HR verification links carry a secret token in the path.
        source: "/verify/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
