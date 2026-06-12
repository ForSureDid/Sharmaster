import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent the site from being embedded in iframes (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from MIME-sniffing the content type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send origin in the Referer header for cross-origin requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable unused browser features
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    minimumCacheTTL: 31536000, // cache optimized images for 1 year
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.donballon.ru",
        pathname: "/upload/**",
      },
      {
        protocol: "https",
        hostname: "tjoreojidkjhfksspbwe.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
