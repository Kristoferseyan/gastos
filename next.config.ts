import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  outputFileTracingRoot: __dirname,
  agentRules: false,
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
