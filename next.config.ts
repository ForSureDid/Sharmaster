import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.donballon.ru",
        pathname: "/upload/**",
      },
    ],
  },
};

export default nextConfig;
