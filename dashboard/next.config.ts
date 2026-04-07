import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  transpilePackages: ["@bahrainstore/theme-metadata"],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
