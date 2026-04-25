"use client";

import { useRef, useState, useEffect, Suspense, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

interface FieldErrors {
  email?: string;
  password?: string;
  captcha?: string;
  form?: string;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha | null>(null);

  // Show error/success from URL params
  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError === "account_not_found") {
      setErrors({ form: "Account not found. Please sign up to create a new account." });
    } else if (urlError === "confirmation_failed") {
      setErrors({ form: "Email confirmation failed. The link may have expired. Please sign up again." });
    } else if (urlError === "invalid_confirmation_link") {
      setErrors({ form: "Invalid confirmation link. Please check your email and try again." });
    }
    if (searchParams.get("confirmed") === "true") {
      setSuccessMessage("Email confirmed! You can now sign in.");
    }
    if (searchParams.get("password_updated") === "true") {
      setSuccessMessage("Password updated successfully. Sign in with your new password.");
    }
  }, [searchParams]);

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Enter a valid email address.";
    }
    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    if (HCAPTCHA_SITE_KEY && !captchaToken) {
      errs.captcha = "Please complete the CAPTCHA.";
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
        ...(captchaToken && { options: { captchaToken } }),
      });

      if (authError) {
        setErrors({ form: "Invalid email or password." });
        // Tokens are single-use — reset for retry.
        captchaRef.current?.resetCaptcha();
        setCaptchaToken(null);
        return;
      }

      const redirectTo = searchParams.get("redirect") || "/dashboard";
      router.push(redirectTo);
      router.refresh();
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="mb-1 text-2xl font-bold text-foreground">Welcome back</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Sign in to pick up where you left off.
      </p>

      {successMessage && (
        <div
          className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
          role="status"
        >
          <span className="flex items-center gap-2">
            <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {successMessage}
          </span>
        </div>
      )}

      {errors.form && (
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
            {errors.form}
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
          error={errors.email}
          placeholder="you@example.com"
        />

        <div>
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            placeholder="Enter your password"
          />
          <div className="mt-1 text-right">
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:text-primary-hover underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* hCaptcha — renders only when site key is configured */}
        {HCAPTCHA_SITE_KEY && (
          <div className="flex flex-col items-center gap-1">
            <HCaptcha
              ref={captchaRef}
              sitekey={HCAPTCHA_SITE_KEY}
              onVerify={(token) => {
                setCaptchaToken(token);
                setErrors((prev) => ({ ...prev, captcha: undefined }));
              }}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />
            {errors.captcha && (
              <p className="text-sm text-destructive" role="alert">{errors.captcha}</p>
            )}
          </div>
        )}

        <Button type="submit" disabled={loading || (!!HCAPTCHA_SITE_KEY && !captchaToken)} className="mt-2 w-full">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or continue with</span>
        </div>
      </div>

      <GoogleSignInButton
        onError={(message) => setErrors({ form: message })}
      />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-primary hover:text-primary-hover underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Sign up
        </Link>
      </p>
    </>
  );
}
