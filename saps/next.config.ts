import { withSentryConfig } from "@sentry/nextjs";
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
    ? "connect-src 'self' ws://localhost:* http://localhost:* http://127.0.0.1:* https://*.supabase.co https://hcaptcha.com https://*.hcaptcha.com https://*.ingest.us.sentry.io https://*.ingest.sentry.io"
    : "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.i.posthog.com https://*.upstash.io https://hcaptcha.com https://*.hcaptcha.com https://*.ingest.us.sentry.io https://*.ingest.sentry.io",
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "saps-57",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Tunnel route disabled — Turbopack (Next.js 16 dev) doesn't apply the
  // rewrite Sentry injects for /monitoring, so the route 404s and events
  // never leave the browser. Clients send directly to ingest.us.sentry.io
  // instead. If ad-blocker bypass becomes important for prod users, revisit
  // once Next.js/Sentry ships Turbopack-compatible tunnel support.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
