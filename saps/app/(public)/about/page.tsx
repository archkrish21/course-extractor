import Link from "next/link";
import type { Metadata } from "next";
import { SUPPORT_URL } from "@/config/support";

export const metadata: Metadata = {
  title: "About — Plan with Genie",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">About Plan with Genie</h1>
      <p className="mt-3 text-base italic text-muted-foreground">
        Plan with Genie started as a Google Sheet on my mom&apos;s laptop. This is the rest of the story.
      </p>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-foreground">
          Free for every student and family. No credit card required.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Start planning →
        </Link>
      </div>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">The story</h2>
          <p className="mt-2">
            In the fall of 2023, I started 9th grade at Stevenson. Within the first few weeks, I was handed a course
            catalog the size of a small novel — hundreds of classes, prerequisite chains, weighted and unweighted
            GPAs, graduation credit minimums — and asked to plan out four years of my life.
          </p>
          <p className="mt-3">It was a lot.</p>
          <p className="mt-3">
            What rescued us — me and my mom, working through it at the kitchen table — was a single Google Sheet. It
            started as a place to list the classes I was considering, and it kept growing. Columns for each semester.
            Color-coding by department. A formula that worked out my GPA. Notes on which courses had honors versions
            and which ones I&apos;d need to talk to a counselor about. Within a few months, that sheet wasn&apos;t a
            worksheet anymore. It was the tool we used to make every academic decision in our family.
          </p>
          <figure className="mt-6 space-y-6">
            <div>
              <img
                src="/about/origin-sheet.png"
                alt="The original Google Sheet — a four-year course planner with semester columns, course rows, grades, and computed GPA"
                className="w-full rounded-xl border border-border shadow-sm"
                loading="lazy"
              />
              <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                Where it started — the Google Sheet, 2023
              </figcaption>
            </div>
            <div>
              <img
                src="/about/planner.png"
                alt="The Plan with Genie planner — the same idea, rebuilt as a real app with prerequisite checks and a validation report"
                className="w-full rounded-xl border border-border shadow-sm"
                loading="lazy"
              />
              <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                Where it is today — Plan with Genie
              </figcaption>
            </div>
          </figure>
          <p className="mt-3">
            Two years later, two things had changed. My classes had given me the confidence to actually build
            things, and the idea of turning that Google Sheet into real software started to excite me.
            Our dinner conversations had also shifted, almost without us noticing, from school-day check-ins to what
            the latest AI models could do. The technology was moving fast enough that I wanted to stop reading about
            it and build something with it.
          </p>
          <p className="mt-3">
            The problem to solve was already in front of me. The Google Sheet was useful, but it was ours — built for
            one student, fragile, impossible to share without someone breaking a formula. So I rebuilt it as software.
            A real database. A real account system. Prerequisite validation, GPA math, graduation tracking, and a way
            for parents and counselors to be part of the planning instead of CC&apos;d on a screenshot.
          </p>
          <p className="mt-3">
            I built Plan with Genie with agentic AI as my engineering partner — not as a gimmick, but as the only way
            a high school student could ship something this size. The judgment about what to build, and how a
            planning tool should feel for the family using it, came from being on the other side of it for two years.
            I&apos;ll keep building it through the rest of high school and beyond — the families using it
            shouldn&apos;t have to wonder if it&apos;ll still be here when their student is a senior.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">What it actually is</h2>
          <p className="mt-2">The Google Sheet, but built for the whole family — and built to actually work.</p>
          <p className="mt-3">
            Where a spreadsheet breaks the moment a parent edits the wrong cell, Plan with Genie gives every member of
            the family the right view: students plan, parents follow along. Prerequisites are checked automatically.
            GPA updates in real time. Graduation requirements stop being a thing you hope you got right.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">For students</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Map four years of courses with prerequisites, credits, and graduation requirements checked as you go.</li>
            <li>Watch your weighted and unweighted GPA update in real time as your plan evolves and grades come in.</li>
            <li>Try out alternate plans without losing the one you&apos;ve been working on.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">For parents</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>See your student&apos;s plan whenever you want, without asking for a screenshot.</li>
            <li>Get the full GPA and credit picture without having to learn the catalog yourself.</li>
            <li>
              Your family&apos;s data stays private. I don&apos;t sell it, and student records are protected.{" "}
              <Link
                href="/privacy"
                className="text-primary hover:underline font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm"
              >
                Read the privacy policy →
              </Link>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">What&apos;s next</h2>
          <p className="mt-2">
            Plan with Genie is live for <strong className="text-foreground">Stevenson families today</strong>, with
            more Illinois high schools coming as demand grows. If your school isn&apos;t supported yet,{" "}
            <Link
              href="/request-school"
              className="text-primary hover:underline font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm"
            >
              request your school
            </Link>{" "}
            — I add schools based on where demand shows up.
          </p>
          <p className="mt-3">On the near-term roadmap:</p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Transcript import</strong> for completed coursework — summer 2026
            </li>
            <li>
              <strong className="text-foreground">Counselor review tools</strong> so a counselor can comment on a
              student&apos;s plan in-app
            </li>
            <li>
              <strong className="text-foreground">AI-assisted course suggestions</strong> tuned to each student&apos;s
              interests and pace
            </li>
            <li>
              <strong className="text-foreground">Career-path alignment</strong>, so the four-year plan ladders into
              what comes after
            </li>
          </ul>
        </section>

        {SUPPORT_URL && (
          <section className="rounded-2xl border border-border bg-muted/30 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <svg aria-hidden="true" className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              Help keep it running
            </h2>
            <p className="mt-2">
              Plan with Genie is free to use. If it&apos;s helped your family, a small contribution toward hosting
              and email costs lets me keep building features instead of figuring out a business model.
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
          <h2 className="text-lg font-semibold text-foreground">Important note</h2>
          <p className="mt-2">
            Plan with Genie is{" "}
            <strong className="text-foreground">
              not affiliated with, endorsed by, or sponsored by any school or school district
            </strong>
            . Course catalog data is sourced from publicly available information. Plan with Genie is not a substitute
            for professional academic counseling.
          </p>
        </section>
      </div>
    </div>
  );
}
