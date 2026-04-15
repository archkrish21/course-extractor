import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const cspHeader = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://hcaptcha.com https://*.hcaptcha.com"
    : "script-src 'self' 'unsafe-inline' https://js.stripe.com https://us-assets.i.posthog.com https://hcaptcha.com https://*.hcaptcha.com",
  "style-src 'self' 'unsafe-inline' https://hcaptcha.com https://*.hcaptcha.com",
  "img-src 'self' data: https:",
  "font-src 'self'",
  isDev
    ? "connect-src 'self' ws://localhost:* http://localhost:* http://127.0.0.1:* https://*.supabase.co https://hcaptcha.com https://*.hcaptcha.com"
    : "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.i.posthog.com https://*.upstash.io https://hcaptcha.com https://*.hcaptcha.com",
  "frame-src https://js.stripe.com https://hcaptcha.com https://*.hcaptcha.com",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: cspHeader,
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
      ],
    },
  ],
};

export default nextConfig;
