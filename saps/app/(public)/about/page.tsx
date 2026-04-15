import Link from "next/link";
import type { Metadata } from "next";
import { SUPPORT_URL } from "@/config/support";

export const metadata: Metadata = {
  title: "About — SAPS",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">About SAPS</h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">Our Story</h2>
          <p className="mt-2">
            SAPS was born out of a simple frustration: planning four years of high school courses shouldn't be this hard.
            As a junior at Adlai E. Stevenson High School, I found myself juggling 300+ course options, complex prerequisite
            chains, graduation credit requirements, and GPA targets — all tracked in spreadsheets and scattered notes.
          </p>
          <p className="mt-3">
            I built SAPS to solve this problem — not just for myself, but for every student who deserves a clear path
            through high school. What started as a personal project has grown into a comprehensive academic planning
            platform used by students, parents, and counselors.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Our Mission</h2>
          <p className="mt-2">
            To give every high school student the tools to plan their academic journey with confidence. We believe
            that with the right planning tools, students can make better course decisions, stay on track for graduation,
            and pursue their academic goals without surprises.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">What We Do</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border p-4">
              <p className="font-semibold text-foreground">Plan</p>
              <p className="mt-1 text-xs">4-year course planning with prerequisite validation and graduation tracking.</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="font-semibold text-foreground">Track</p>
              <p className="mt-1 text-xs">Real-time GPA calculation, grade tracking, and academic progress monitoring.</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="font-semibold text-foreground">Connect</p>
              <p className="mt-1 text-xs">Link parents, guardians, and counselors for shared visibility into your plan.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Looking Ahead</h2>
          <p className="mt-2">
            SAPS currently supports Stevenson High School, but we're building for every high school.
            Our roadmap includes AI-powered course recommendations, career path alignment,
            and support for schools across Illinois and beyond.
          </p>
          <p className="mt-3">
            <Link href="/signup" className="text-primary hover:underline font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm">
              Join us
            </Link>{" "}
            and be part of the journey.
          </p>
        </section>

        {SUPPORT_URL && (
          <section className="rounded-2xl border border-border bg-muted/30 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <svg aria-hidden="true" className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              Support SAPS
            </h2>
            <p className="mt-2">
              SAPS is built by a high school student in his spare time. If it&apos;s helped
              you plan your courses, a small contribution helps cover hosting and keeps it free for everyone.
            </p>
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              Support on Ko-fi
            </a>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold text-foreground">Important Note</h2>
          <p className="mt-2">
            SAPS is <strong className="text-foreground">not affiliated with, endorsed by, or sponsored by
            Adlai E. Stevenson High School</strong> or any educational institution. Course catalog data is
            sourced from publicly available information. SAPS is not a substitute for professional academic counseling.
          </p>
        </section>
      </div>
    </div>
  );
}
