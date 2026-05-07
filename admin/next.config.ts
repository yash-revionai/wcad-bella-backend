import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.app.github.dev"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
