import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "@phosphor-icons/react", "@phosphor-icons/react/dist/ssr"],
  },
};

export default nextConfig;
