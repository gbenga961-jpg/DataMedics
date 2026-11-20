import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep BullMQ, ioredis and their optional peer deps out of the webpack bundle.
  // BullMQ dynamically references @valkey/valkey-glide which is optional and
  // not installed; without this Webpack throws "Module not found" at build time.
  serverExternalPackages: ["bullmq", "ioredis", "@valkey/valkey-glide"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Treat the optional valkey-glide peer as external so webpack never
      // tries to resolve or bundle it.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        "@valkey/valkey-glide",
      ];
    } else {
      // On the client bundle simply provide an empty stub so any accidental
      // transitive import is a no-op rather than a build error.
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        "@valkey/valkey-glide": false,
      };
    }
    return config;
  },
};

export default nextConfig;
