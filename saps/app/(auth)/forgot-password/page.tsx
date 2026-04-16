"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (HCAPTCHA_SITE_KEY && !captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
          captchaToken: captchaToken ?? undefined,
        }
      );

      if (resetError) {
        setError("Failed to send reset email. Please try again.");
        captchaRef.current?.resetCaptcha();
        setCaptchaToken(null);
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
          <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-foreground">Check your email</h2>
        <p className="mb-2 text-sm text-muted-foreground">
          We sent a password reset link to
        </p>
        <p className="mb-6 text-sm font-medium text-foreground">{email}</p>
        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive it?{" "}
          <button
            type="button"
            onClick={() => { setSent(false); captchaRef.current?.resetCaptcha(); setCaptchaToken(null); }}
            className="font-medium text-primary hover:text-primary-hover underline underline-offset-4"
          >
            Try again
          </button>
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary-hover underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <h2 className="mb-1 text-2xl font-bold text-foreground">Reset your password</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      {error && (
        <div
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive-light p-3 text-sm text-destructive"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            {error}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        {HCAPTCHA_SITE_KEY && (
          <div className="flex justify-center">
            <HCaptcha
              ref={captchaRef}
              sitekey={HCAPTCHA_SITE_KEY}
              onVerify={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
            />
          </div>
        )}

        <Button type="submit" disabled={loading || !email.trim() || (!!HCAPTCHA_SITE_KEY && !captchaToken)} className="mt-2 w-full">
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:text-primary-hover underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
