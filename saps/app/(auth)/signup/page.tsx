"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Role = "student" | "parent" | "counselor";

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  dob?: string;
  role?: string;
  form?: string;
}

const ROLES: { value: Role; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
  { value: "counselor", label: "Counselor" },
];

function isUnder13(dob: string): boolean {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age < 13;
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dob, setDob] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [coppaBlocked, setCoppaBlocked] = useState(false);

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
    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }
    if (!dob) {
      errs.dob = "Date of birth is required.";
    } else if (isUnder13(dob)) {
      errs.dob = "You must be at least 13 years old to create an account.";
    }
    if (!role) {
      errs.role = "Please select a role.";
    }
    return errs;
  }

  function handleDobChange(value: string) {
    setDob(value);
    if (value && isUnder13(value)) {
      setCoppaBlocked(true);
    } else {
      setCoppaBlocked(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    if (coppaBlocked) return;

    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, date_of_birth: dob, role }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ form: data?.error?.message || data?.message || "Signup failed. Please try again." });
        return;
      }

      // Parents go to onboarding with add_child flow; students go to onboarding
      if (role === "parent") {
        router.push("/onboarding?add_child=true");
      } else {
        router.push("/onboarding");
      }
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="mb-1 text-xl font-semibold text-foreground">Create your account</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Start planning your academic path today.
      </p>

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

      {coppaBlocked && (
        <div
          className="mb-4 rounded-lg border border-warning/30 bg-warning-light p-4 text-sm text-warning"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-2">
            <svg
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0"
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
            <div>
              <p className="font-semibold">Account creation unavailable</p>
              <p className="mt-1">
                You must be at least 13 years old to create a SAPS account (COPPA compliance).
                Please ask a parent or guardian for assistance.
              </p>
            </div>
          </div>
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

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          helperText="Must be at least 8 characters."
          placeholder="Create a password"
        />

        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          placeholder="Confirm your password"
        />

        <Input
          label="Date of birth"
          type="date"
          required
          value={dob}
          onChange={(e) => handleDobChange(e.target.value)}
          error={errors.dob}
          max={new Date().toISOString().split("T")[0]}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">
            I am a <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
          </legend>
          <div className="flex gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={role === r.value}
                onClick={() => setRole(r.value)}
                className={`
                  flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium
                  min-h-[44px] cursor-pointer
                  transition-colors duration-150
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                  ${
                    role === r.value
                      ? "border-primary bg-primary-light text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-secondary hover:bg-muted"
                  }
                `}
              >
                {r.label}
              </button>
            ))}
          </div>
          {errors.role && (
            <p className="mt-1.5 text-sm text-destructive" role="alert">
              {errors.role}
            </p>
          )}
        </fieldset>

        <Button
          type="submit"
          disabled={loading || coppaBlocked}
          className="mt-2 w-full"
        >
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:text-primary-hover underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Sign in
        </Link>
      </p>

      <p className="mt-3 text-center text-sm text-muted-foreground">
        Have a claim code from your parent?{" "}
        <Link
          href="/claim"
          className="font-medium text-primary hover:text-primary-hover underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Claim your account
        </Link>
      </p>
    </>
  );
}
