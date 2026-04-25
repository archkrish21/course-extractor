"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RequestSchoolForm() {
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!school.trim() || !email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/school-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school: school.trim(), email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError("Couldn't send your request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="mt-6 text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight tracking-[-0.02em] text-foreground">
          You&rsquo;re on the list.
        </h1>
        <p className="mt-3 text-foreground-muted">
          We&rsquo;ll email you the moment Genie supports your school.
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-[clamp(2rem,4.5vw,3rem)] font-bold leading-tight tracking-[-0.02em] text-foreground">
        Bring Genie to your school.
      </h1>
      <p className="mt-4 text-foreground-muted">
        Tell us where you&rsquo;re from. We&rsquo;ll email you the moment Genie supports your school.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <Input
          label="School name"
          type="text"
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          placeholder="School name and state"
          required
          autoComplete="organization"
        />
        <Input
          label="Your email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />

        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={!school.trim() || !email.trim() || loading}
        >
          {loading ? "Sending…" : "Notify Me"}
        </Button>
      </form>
    </>
  );
}
