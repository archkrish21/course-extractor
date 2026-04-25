"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Last-resort error boundary — fires when the root layout itself crashes,
 * so this file has to ship its own <html> and <body> and can't rely on
 * globals.css tokens being inherited through a layout. Styling is inlined
 * to match the DESIGN.md §10.5 error pattern without depending on layout.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
          <div className="flex w-full max-w-md flex-col items-center">
            <div className="flex h-24 w-24 items-center justify-center text-foreground-muted/30">
              <svg
                aria-hidden="true"
                className="h-full w-full"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Something went wrong
            </h1>
            <p className="mt-3 text-foreground-muted">
              The page couldn&rsquo;t load. Try reloading, or head back home.
            </p>
            <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Try again
              </button>
              <a
                href="/"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-transparent px-8 text-base font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Back to home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
