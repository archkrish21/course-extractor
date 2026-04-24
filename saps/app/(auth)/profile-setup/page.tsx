"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type Role = "student" | "parent" | "guardian" | "counselor";

// v1-hide: counselor role removed from UI; re-add { value: "counselor", ... } to restore.
const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "student", label: "Student", desc: "Plan your courses" },
  { value: "parent", label: "Parent", desc: "Monitor progress" },
  { value: "guardian", label: "Guardian", desc: "Support your student" },
];

export default function ProfileSetupPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Pre-populate name from auth/me and redirect if already completed
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/v1/auth/me");
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        const json = await res.json();
        const data = json.data ?? json;
        if (data.profile_setup_completed) {
          router.replace("/dashboard");
          return;
        }
        if (data.first_name) {
          setName(data.first_name);
        }
      } catch {
        router.replace("/login");
        return;
      }
      setChecking(false);
    }
    check();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !ageConfirmed || !tosAccepted) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/profile-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name: name.trim(),
          age_confirmed: true,
          tos_accepted: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }

      const data = await res.json();
      const next = data?.data?.next ?? "/dashboard";
      router.push(next);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="-mx-6 -my-6 sm:-mx-8 sm:-my-8">
      <div className="mx-auto max-w-[540px] px-6 py-6 sm:px-8 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Almost there</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell me a bit about yourself before we get started.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive-light px-4 py-3 text-sm text-destructive" role="alert">
            <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Role selector */}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">I am a</legend>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={role === r.value}
                  onClick={() => setRole(r.value)}
                  className={`
                    flex h-full flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-3 text-center
                    min-h-[44px] cursor-pointer transition-all duration-150
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                    ${role === r.value
                      ? "border-primary bg-primary-light text-primary shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted/50"
                    }
                  `}
                >
                  <span className="text-sm font-semibold">{r.label}</span>
                  <span className="text-[10px] leading-tight">{r.desc}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Name */}
          <Input
            label="First name"
            type="text"
            autoComplete="given-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
          />

          {/* School context (read-only) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">State</label>
              <div className="flex h-11 min-h-[44px] items-center rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed">
                Illinois
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">School</label>
              <div className="flex h-11 min-h-[44px] items-center rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed">
                Adlai E. Stevenson High School
              </div>
            </div>
          </div>
          <p className="-mt-3 text-[11px] text-muted-foreground">
            Currently supporting Stevenson High School. More schools coming soon.
          </p>

          {/* Age confirmation (COPPA) */}
          <Checkbox
            id="age-confirm-checkbox"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            label={<span className="text-xs">I confirm that I am at least 13 years old.</span>}
          />

          {/* Terms of Service & Privacy Policy */}
          <Checkbox
            id="tos-checkbox"
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
            label={
              <span className="text-xs">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>.
                {(role === "parent" || role === "guardian") && (
                  <span className="block mt-0.5 text-muted-foreground">
                    I confirm that I am the parent or legal guardian of the student.
                  </span>
                )}
              </span>
            }
          />

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading || !ageConfirmed || !tosAccepted || !name.trim()}
            className="w-full"
          >
            {loading ? "Setting up..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
