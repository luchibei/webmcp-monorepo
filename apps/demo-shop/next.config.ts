import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@luchibei/webmcp-sdk",
    "@luchibei/webmcp-react",
    "@luchibei/webmcp-sw-runtime"
  ]
};

export default nextConfig;
