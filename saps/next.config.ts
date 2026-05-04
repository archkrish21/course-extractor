import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Guard: NEXT_PUBLIC_E2E_DISABLE_TELEMETRY is meant for Playwright's webServer
// only. If it leaks into a real Vercel production deploy, Sentry/PostHog
// would silently go dark — fail the build loudly instead.
if (
  process.env.VERCEL_ENV === "production" &&
  process.env.NEXT_PUBLIC_E2E_DISABLE_TELEMETRY
) {
  throw new Error(
    "NEXT_PUBLIC_E2E_DISABLE_TELEMETRY must not be set in production builds. " +
      "It exists to silence Sentry/PostHog during E2E runs and would disable " +
      "real telemetry if shipped. Remove it from the Vercel project's env.",
  );
}

// Guard: PostHog init in lib/analytics/posthog.ts gates on
// NEXT_PUBLIC_VERCEL_ENV === "production". Vercel's "Automatically expose
// System Environment Variables" mirrors VERCEL_ENV → NEXT_PUBLIC_VERCEL_ENV;
// if that toggle gets disabled, prod telemetry silently goes dark. Fail the
// build loudly instead.
if (
  process.env.VERCEL_ENV === "production" &&
  process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
) {
  throw new Error(
    "VERCEL_ENV=production but NEXT_PUBLIC_VERCEL_ENV is not. PostHog init " +
      "gates on the public var and would silently skip event capture. Re-enable " +
      "'Automatically expose System Environment Variables' in the Vercel " +
      "project settings.",
  );
}

const isDev = process.env.NODE_ENV === "development";

// In E2E we run a production build pointed at the local Supabase emulator
// (http://127.0.0.1:54321). Allow that origin through the prod CSP so the
// auth client can reach it. Real production builds use https://*.supabase.co
// which is already covered by the wildcard.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const localSupabase = supabaseUrl.startsWith("http://") ? ` ${supabaseUrl}` : "";

const cspHeader = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://hcaptcha.com https://*.hcaptcha.com https://accounts.google.com/gsi/client"
    : "script-src 'self' 'unsafe-inline' https://js.stripe.com https://us-assets.i.posthog.com https://hcaptcha.com https://*.hcaptcha.com https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://hcaptcha.com https://*.hcaptcha.com https://accounts.google.com/gsi/style",
  "img-src 'self' data: https:",
  "font-src 'self'",
  isDev
    ? "connect-src 'self' ws://localhost:* http://localhost:* http://127.0.0.1:* https://*.supabase.co https://hcaptcha.com https://*.hcaptcha.com https://*.ingest.us.sentry.io https://*.ingest.sentry.io https://*.i.posthog.com https://accounts.google.com/gsi/"
    : `connect-src 'self' https://*.supabase.co${localSupabase} https://api.stripe.com https://*.i.posthog.com https://*.upstash.io https://hcaptcha.com https://*.hcaptcha.com https://*.ingest.us.sentry.io https://*.ingest.sentry.io https://accounts.google.com/gsi/`,
  "frame-src https://js.stripe.com https://hcaptcha.com https://*.hcaptcha.com https://accounts.google.com/gsi/",
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
