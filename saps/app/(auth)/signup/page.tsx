"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

type Role = "student" | "parent" | "guardian" | "counselor";

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  ageConfirmed?: string;
  role?: string;
  tos?: string;
  captcha?: string;
  form?: string;
}

// v1-hide: counselor role removed from UI; re-add { value: "counselor", ... } to restore.
const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "student", label: "Student", desc: "Plan your courses" },
  { value: "parent", label: "Parent", desc: "Monitor progress" },
  { value: "guardian", label: "Guardian", desc: "Support your student" },
];

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [role, setRole] = useState<Role>("student");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showSchoolRequest, setShowSchoolRequest] = useState(false);
  const [requestSchool, setRequestSchool] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [schoolRequestSent, setSchoolRequestSent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [hasInvite, setHasInvite] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha | null>(null);

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    else if (password.length < 8) errs.password = "Must be at least 8 characters.";
    if (!confirmPassword) errs.confirmPassword = "Please confirm your password.";
    else if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match.";
    if (!ageConfirmed) errs.ageConfirmed = "You must be at least 13 years old to create an account.";
    if (!role) errs.role = "Please select a role.";
    if (!tosAccepted) errs.tos = "You must agree to continue.";
    if (HCAPTCHA_SITE_KEY && !captchaToken) errs.captcha = "Please complete the CAPTCHA.";
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }
    setErrors({}); setLoading(true);

    try {
      const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const inviteCode = urlParams.get("invite") ?? urlParams.get("code") ?? undefined;
      const inviteAccount = urlParams.get("account") ?? undefined;

      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, password, role, age_confirmed: true,
          state: "IL", school_name: "Adlai E. Stevenson High School", tos_accepted: true,
          ...(inviteCode && { invite_code: inviteCode }),
          ...(inviteAccount && { invite_account: inviteAccount }),
          ...(captchaToken && { captcha_token: captchaToken }),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ form: data?.error?.message || data?.message || "Signup failed. Please try again." });
        // Reset CAPTCHA so the user can re-solve on retry (tokens are single-use).
        captchaRef.current?.resetCaptcha();
        setCaptchaToken(null);
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (data?.data?.email_confirmation_pending) {
        setHasInvite(!!inviteCode);
        setConfirmationPending(true);
        return;
      }

      if (inviteCode && inviteAccount) {
        // The server established the session cookie during signup (via
        // admin.generateLink + verifyOtp), so we can redirect directly.
        router.push(`/join?code=${inviteCode}&account=${inviteAccount}`);
      } else if (role === "student") {
        router.push("/onboarding?welcome=1");
      } else {
        // Non-student roles (parent, guardian, counselor) skip onboarding
        // and go to dashboard if they have plans, or planner otherwise
        router.push("/dashboard");
      }
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  if (confirmationPending) {
    return (
      <div className="-mx-6 -my-6 sm:-mx-8 sm:-my-8">
        <div className="mx-auto max-w-[540px] px-6 py-6 sm:px-8 sm:py-8">
          <div className="text-center py-12">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
              We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
              {hasInvite
                ? " Click the link to verify your email and join the account."
                : " Click the link to verify your email and get started."}
            </p>
            {hasInvite && (
              <p className="mt-2 text-xs text-primary max-w-sm mx-auto">
                After confirming, you&apos;ll be automatically connected to the parent&apos;s account.
              </p>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button
                type="button"
                onClick={() => setConfirmationPending(false)}
                className="text-primary underline hover:no-underline"
              >
                try again
              </button>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-6 -my-6 sm:-mx-8 sm:-my-8">
      {/* Wider signup layout */}
      <div className="mx-auto max-w-[540px] px-6 py-6 sm:px-8 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A minute of setup, four years of plans.
          </p>
        </div>

        {/* Error banner */}
        {errors.form && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive-light px-4 py-3 text-sm text-destructive" role="alert">
            <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* Step 1: Role */}
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
            {errors.role && <p className="mt-1.5 text-sm text-destructive" role="alert">{errors.role}</p>}
          </fieldset>

          {/* Step 2: Credentials — 2 column */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                error={errors.email} placeholder="you@example.com" />
            </div>
            <Input label="Password" type="password" autoComplete="new-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              error={errors.password} placeholder="Min. 8 characters" />
            <Input label="Confirm password" type="password" autoComplete="new-password" required
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword} placeholder="Re-enter password" />
          </div>

          {/* Step 3: School context */}
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
            Currently supporting Stevenson High School. More schools coming soon.{" "}
            <button type="button" onClick={() => setShowSchoolRequest(true)} className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded">
              Request yours
            </button>
          </p>

          {/* School request form */}
          {showSchoolRequest && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="mb-3 text-xs font-medium text-foreground">Request your school</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input label="School name" hideLabel type="text" value={requestSchool} onChange={(e) => setRequestSchool(e.target.value)}
                  placeholder="School name and state" />
                <Input label="Your email" hideLabel type="email" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)}
                  placeholder="Your email" />
              </div>
              <Button type="button" size="sm" className="mt-3 w-full"
                disabled={!requestSchool.trim() || !requestEmail.trim() || schoolRequestSent}
                onClick={async () => {
                  try { await fetch("/api/v1/school-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ school: requestSchool.trim(), email: requestEmail.trim() }) }); } catch {}
                  setSchoolRequestSent(true);
                }}>
                {schoolRequestSent ? "Sent!" : "Notify me"}
              </Button>
              {schoolRequestSent && (
                <p className="mt-2 text-xs text-success">Thanks! We&apos;ll notify you when your school is supported.</p>
              )}
            </div>
          )}

          {/* Age confirmation (COPPA) */}
          <Checkbox
            id="age-confirm-checkbox"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            error={errors.ageConfirmed}
            label={<span className="text-xs">I confirm that I am at least 13 years old.</span>}
          />

          {/* Terms */}
          <Checkbox
            id="tos-checkbox"
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
            error={errors.tos}
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

          {/* Submit */}
          <Button type="submit" disabled={loading || !tosAccepted || !ageConfirmed || (!!HCAPTCHA_SITE_KEY && !captchaToken)} className="w-full">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
