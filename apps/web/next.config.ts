import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@yh/core"],
  devIndicators: false
};

export default nextConfig;
