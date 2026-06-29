import type { NextConfig } from "next";

const SUPABASE_HOST = "tjoreojidkjhfksspbwe.supabase.co";

const isDev = process.env.NODE_ENV === 'development'

const csp = [
  "default-src 'self'",
  // unsafe-eval is only needed for Next.js dev hot-reload, never in production
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  // Tailwind / Next.js inject inline styles
  "style-src 'self' 'unsafe-inline'",
  // Images from Supabase storage and donballon.ru supplier CDN
  `img-src 'self' data: blob: https://www.donballon.ru https://${SUPABASE_HOST}`,
  "font-src 'self' data:",
  // XHR/fetch: only to self and Supabase
  `connect-src 'self' https://${SUPABASE_HOST}`,
  // Prevent <base> tag injection (redirects all relative URLs to attacker domain)
  "base-uri 'self'",
  // Prevent forms from being submitted to external sites
  "form-action 'self'",
  // Belt-and-suspenders with X-Frame-Options
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // 2 years; includeSubDomains + preload once confirmed working
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
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
    loaderFile: './supabase-image-loader.ts',
    minimumCacheTTL: 31536000,
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
