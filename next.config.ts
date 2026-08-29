import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  devIndicators: false,
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "developers.soundcloud.com" }] },
};
export default nextConfig;
