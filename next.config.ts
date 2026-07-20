import type { NextConfig } from "next";

const SUPABASE_HOST = "tjoreojidkjhfksspbwe.supabase.co";

const isDev = process.env.NODE_ENV === 'development'

// Analytics/marketing vendors — only loaded client-side once the matching
// cookie-consent category is granted (see components/AnalyticsScripts.tsx),
// but the CSP itself is static, so their hosts must be allowlisted here too,
// otherwise the browser silently blocks them the moment a real ID is set.
const GA_GTM_HOSTS = "https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com";
const YM_HOST = "https://mc.yandex.ru";
const META_PIXEL_HOST = "https://connect.facebook.net https://www.facebook.com";

const csp = [
  "default-src 'self'",
  // unsafe-eval is only needed for Next.js dev hot-reload, never in production
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} ${GA_GTM_HOSTS} ${YM_HOST} ${META_PIXEL_HOST}`,
  // Tailwind / Next.js inject inline styles
  "style-src 'self' 'unsafe-inline'",
  // Images from Supabase storage, donballon.ru supplier CDN, and analytics pixels
  `img-src 'self' data: blob: https://www.donballon.ru https://${SUPABASE_HOST} ${YM_HOST} ${META_PIXEL_HOST}`,
  "font-src 'self' data:",
  // XHR/fetch/beacon: self, Supabase, and the analytics vendors above
  `connect-src 'self' https://${SUPABASE_HOST} ${GA_GTM_HOSTS} ${YM_HOST} ${META_PIXEL_HOST}`,
  // GTM's <noscript> fallback embeds an iframe from googletagmanager.com
  "frame-src https://www.googletagmanager.com",
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
  typescript: {
    ignoreBuildErrors: true,
  },
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
