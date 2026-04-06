"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface PendingDocument {
  id: string;
  type: string;
  version: string;
  summary: string | null;
}

export default function ConsentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/dashboard";

  const [pending, setPending] = useState<PendingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/v1/auth/consent");
        if (res.ok) {
          const json = await res.json();
          const data = json.data ?? json;
          if (!data.consent_required) {
            // Already consented — redirect
            router.replace(nextUrl);
            return;
          }
          setPending(data.pending_documents ?? []);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    fetchStatus();
  }, [router, nextUrl]);

  async function handleAccept() {
    if (!accepted || pending.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: pending.map((d) => d.id) }),
      });
      if (res.ok) {
        router.replace(nextUrl);
      } else {
        const json = await res.json().catch(() => null);
        const msg = json?.error?.message ?? "Failed to record consent.";
        if (res.status === 404) {
          setError("Account not found. Please sign up to create a new account.");
        } else {
          setError(msg);
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const isUpdate = pending.some((d) => d.summary && d.summary !== "Initial version");

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="text-center">
        <svg aria-hidden="true" className="mx-auto h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          {isUpdate ? "We've Updated Our Terms" : "Review Our Terms"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isUpdate
            ? "Please review and accept the updated terms before continuing."
            : "Before you get started, please review and accept our Terms of Service and Privacy Policy."}
        </p>
      </div>

      {/* Summary of changes (for updates) */}
      {isUpdate && (
        <div className="mt-6 rounded-lg border border-warning/30 bg-warning-light p-4">
          <p className="text-sm font-semibold text-warning">What changed:</p>
          <ul className="mt-1 space-y-1">
            {pending.map((d) => (
              <li key={d.id} className="text-sm text-foreground">
                {d.type === "terms_of_service" ? "Terms of Service" : "Privacy Policy"} v{d.version}
                {d.summary && d.summary !== "Initial version" && ` — ${d.summary}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Document links */}
      <div className="mt-6 space-y-3">
        <Link
          href="/terms"
          target="_blank"
          className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">Terms of Service</p>
            <p className="text-xs text-muted-foreground">Read the full terms</p>
          </div>
          <svg aria-hidden="true" className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </Link>

        <Link
          href="/privacy"
          target="_blank"
          className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">Privacy Policy</p>
            <p className="text-xs text-muted-foreground">How we handle your data</p>
          </div>
          <svg aria-hidden="true" className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </Link>
      </div>

      {/* Consent checkbox */}
      <div className="mt-6">
        <Checkbox
          id="consent-checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          label={
            <span>
              I have read and agree to the{" "}
              <Link href="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</Link>
              {" "}and{" "}
              <Link href="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>.
            </span>
          }
        />
      </div>

      {error && (
        <div className="mt-3 text-sm text-destructive" role="alert">
          <p>{error}</p>
          {error.includes("sign up") && (
            <Link href="/signup" className="mt-2 inline-block text-primary hover:underline">
              Go to Sign Up
            </Link>
          )}
        </div>
      )}

      <Button
        className="mt-6 w-full"
        onClick={handleAccept}
        disabled={!accepted || submitting}
      >
        {submitting ? "Saving..." : "Continue"}
      </Button>
    </div>
  );
}
