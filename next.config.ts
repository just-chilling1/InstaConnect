import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.instantdb.com" },
      { protocol: "https", hostname: "storage.instantdb.com" },
    ],
  },
};

export default nextConfig;
