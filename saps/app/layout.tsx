import { Suspense } from "react";
import type { Metadata } from "next";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAPS — Student Academic Planning System",
  description:
    "Plan your 4-year high school course path, track grades and GPA, monitor graduation requirements, and keep parents and counselors in the loop. Free for Stevenson High School students.",
  keywords: ["academic planning", "high school", "course planner", "GPA tracker", "graduation requirements", "Stevenson High School"],
  icons: {
    icon: [
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    title: "Plan with Genie",
  },
  openGraph: {
    title: "SAPS — Student Academic Planning System",
    description: "Plan your 4-year high school journey. Track grades, GPA, and graduation progress.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Suspense fallback={null}>
          <PostHogProvider />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
