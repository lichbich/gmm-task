import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress responses with Gzip / Brotli to minimize bandwidth
  compress: true,

  // Tree-shake lucide-react icons so unused icon components are not included in JS bundle
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
