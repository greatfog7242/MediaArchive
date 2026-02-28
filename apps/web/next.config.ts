import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker multi-stage standalone build
  output: "standalone",

  // Suppress build-time env validation warnings
  // Runtime validation is handled by src/lib/env.ts
  experimental: {
    // React 19 server actions
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
