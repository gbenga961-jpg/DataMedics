import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["bullmq", "ioredis"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
