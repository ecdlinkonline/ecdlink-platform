import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const environment = process.env.NODE_ENV === "production" ? "production" : "development";
    return [{ source: "/(.*)", headers: buildSecurityHeaders(environment) }];
  }
};

export default nextConfig;
