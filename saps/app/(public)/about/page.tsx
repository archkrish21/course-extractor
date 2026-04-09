import Link from "next/link";
import type { Metadata } from "next";

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
