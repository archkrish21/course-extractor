"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClaimAccountPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmed = code.trim();
    if (!trimmed) {
      setError("Please enter a claim code.");
      return;
    }
    if (trimmed.length !== 8) {
      setError("Claim codes are 8 characters long.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/accounts/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_code: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data?.error?.message ||
            data?.message ||
            "Invalid or expired claim code. Please check and try again."
        );
        return;
      }

      const data = await res.json();
      const accountId = data?.account_id ?? data?.accountId;

      // Store the claimed account as active
      if (accountId && typeof window !== "undefined") {
        localStorage.setItem("saps_current_account_id", accountId);
      }

      router.push("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="mb-1 text-xl font-semibold text-foreground">
        Claim your account
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Enter the 8-character claim code your parent shared with you to take
        ownership of your student account.
      </p>

      {error && (
        <div
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive-light p-3 text-sm text-destructive"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            {error}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Claim code"
          type="text"
          required
          autoComplete="off"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A1B2C3D4"
          helperText="Ask your parent for this code."
          className="text-center text-lg font-mono tracking-[0.3em] uppercase"
        />

        <Button type="submit" disabled={loading} className="mt-2 w-full">
          {loading ? "Claiming..." : "Claim Account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have a claim code?{" "}
        <Link
          href="/signup"
          className="font-medium text-primary hover:text-primary-hover underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Create your own account
        </Link>
      </p>
    </>
  );
}
