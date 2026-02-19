import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@webmcp/webmcp-sdk", "@webmcp/webmcp-react", "@webmcp/webmcp-sw-runtime"]
};

export default nextConfig;
