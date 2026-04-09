"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/api-client";

interface PendingDocument {
  id: string;
  type: string;
  version: string;
  summary: string | null;
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
      <ConsentPageInner />
    </Suspense>
  );
}

function ConsentPageInner() {
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
        const res = await apiFetch("/api/v1/auth/consent");
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
      const res = await apiFetch("/api/v1/auth/consent", {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <svg aria-hidden="true" className="mx-auto h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
        <h2 className="mt-4 text-2xl font-bold text-foreground">
          {isUpdate ? "We've Updated Our Terms" : "Review Our Terms"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isUpdate
            ? "Please review and accept the updated terms before continuing."
            : "Before you get started, please review and accept our Terms of Service and Privacy Policy."}
        </p>
      </div>

      {/* Summary of changes (for updates) */}
      {isUpdate && (
        <div className="rounded-lg border border-warning/30 bg-warning-light p-4">
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

      {/* Document list */}
      <div className="divide-y divide-border rounded-lg border border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-foreground">Terms of Service</span>
          <Link
            href="/terms"
            target="_blank"
            className="text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            View
          </Link>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-foreground">Privacy Policy</span>
          <Link
            href="/privacy"
            target="_blank"
            className="text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            View
          </Link>
        </div>
      </div>

      {/* Consent checkbox */}
      <Checkbox
        id="consent-checkbox"
        checked={accepted}
        onChange={(e) => setAccepted(e.target.checked)}
        label={
          <span>
            I have read and agree to the{" "}
            <Link href="/terms" target="_blank" className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" target="_blank" className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Privacy Policy</Link>.
          </span>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive-light p-3 text-sm text-destructive" role="alert">
          <span className="flex items-center gap-2">
            <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            {error}
          </span>
          {error.includes("sign up") && (
            <Link href="/signup" className="mt-2 inline-block text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              Go to Sign Up
            </Link>
          )}
        </div>
      )}

      {/* Button pair */}
      <div className="flex gap-3">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() => router.replace("/")}
          disabled={submitting}
        >
          Decline
        </Button>
        <Button
          className="flex-1"
          onClick={handleAccept}
          disabled={!accepted || submitting}
        >
          {submitting ? "Saving..." : "Accept"}
        </Button>
      </div>
    </div>
  );
}
