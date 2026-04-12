import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  transpilePackages: ["@bahrainstore/theme-metadata"],
  async headers() {
    return [
      {
        source: "/login",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
        ],
      },
      {
        source: "/register",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
        ],
      },
      {
        source: "/forgot-password",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
        ],
      },
      {
        source: "/reset-password",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
        ],
      },
      {
        source: "/accept-invite",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
        ],
      },
    ];
  },
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
