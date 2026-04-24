"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HOME_FEATURES } from "@/config/homepage";

// ── Data ────────────────────────────────────────────────────────────────────

const HOW_IT_WORKS_STEPS = [
  {
    n: "01",
    t: "Tell Genie your goals",
    d: `College track, trade school, or just "I don't know yet" — all valid starts.`,
  },
  {
    n: "02",
    t: "See your path mapped",
    d: "Every graduation requirement, course by course, across all four years.",
  },
  {
    n: "03",
    t: "Adjust as you grow",
    d: "Swap courses, explore AP routes, keep your plan in sync with real life.",
  },
];

const FEATURES = [
  {
    title: "Four-year course planner",
    desc: "Drag, drop, and plan across all four years. See your entire academic path at a glance with a visual semester grid.",
    icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5",
    color: "bg-primary/10 text-primary",
  },
  {
    title: "GPA & grade tracking",
    desc: "Real-time weighted and unweighted GPA. Projected grades, what-if scenarios, and semester-by-semester trends.",
    icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
    color: "bg-success/10 text-success",
  },
  {
    title: "Graduation progress",
    desc: "Track 37 requirements across 4 categories. Visual progress bars show earned, planned, and remaining credits.",
    icon: "M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z",
    color: "bg-warning/10 text-warning",
  },
  {
    title: "Prerequisite intelligence",
    desc: "Automatic chain validation catches scheduling conflicts before they happen. Never get blocked from a course again.",
    icon: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244",
    color: "bg-ap/10 text-ap",
  },
  {
    title: "Family access",
    desc: "Link parents and guardians. Everyone stays informed with shared visibility into plans and progress.",
    icon: "M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z",
    color: "bg-primary/10 text-primary",
  },
];

const FAQS = [
  { q: "Is Genie free?", a: "Yes! Genie is completely free during early access. Create your account and start planning today — no credit card required." },
  { q: "Is Genie affiliated with Stevenson High School?", a: "No. Plan with Genie is an independent tool built by a Stevenson student. It is not affiliated with, endorsed by, or sponsored by Adlai E. Stevenson High School." },
  { q: "How is my data protected?", a: "Your data is encrypted in transit, stored securely, and never sold to third parties. You can delete your account and all data at any time." },
  { q: "Can my parents see my grades?", a: "Only if you invite them. Parents and guardians can be linked to your account with view access. You control who sees your data." },
  { q: "How much does Genie cost?", a: "Genie is free during early access. As we grow, we'll add paid features — early users get a heads-up before anything changes." },
  { q: "Can I use Genie if I go to a different school?", a: "Genie currently supports Stevenson High School. We're expanding to more schools soon — request yours during signup." },
  { q: "Who built Genie?", a: "Genie was built by a junior at Stevenson High School who wanted a better way to plan courses and track academic progress." },
];

const TESTIMONIALS = [
  { name: "Maya S.", role: "Sophomore", quote: "Genie helped me map out my AP track through senior year. I can finally see how everything connects." },
  { name: "David P.", role: "Parent", quote: "As a parent, I love being able to see my son's plan and graduation progress without having to ask constantly." },
  { name: "Jordan K.", role: "Senior", quote: "Seeing graduation requirements alongside my plan kept me on track — no surprises come senior year." },
];

const PRICING_TIERS = [
  { name: "Starter", price: "Free", period: "forever", features: ["1 plan", "3 linked accounts", "Course browser", "Prerequisite validation", "GPA tracking"], cta: "Get Started", highlight: false },
  { name: "Plus", price: "$9.99", period: "/month", features: ["10 plans", "5 linked accounts", "What-if GPA", "Plan comparison", "PDF export/print", "Share links", "Goal tracking"], cta: "Start Free Trial", highlight: true },
  { name: "Elite", price: "$19.99", period: "/month", features: ["Unlimited plans", "8 linked accounts", "Everything in Plus", "AI suggestions", "AI plan review", "Percentile comparison"], cta: "Start Free Trial", highlight: false },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      {/* ─── Hero — V1 Emerald-forward, per DESIGN.md §10.1 ───────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pb-20 sm:pt-20 lg:pt-28">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            {/* Left — copy */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Early access
              </div>

              <h1 className="mt-6 text-[clamp(2.25rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.025em] text-foreground">
                <span className="whitespace-nowrap">Your four-year plan.</span>
                <br />
                <span className="text-primary">Granted.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-foreground-muted lg:mx-0">
                Tell Genie what you want out of high school. We&rsquo;ll map the path &mdash; course by course, year by year.
              </p>

              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
                <Link
                  href="/signup"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Get Started Free
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-transparent px-8 text-base font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  See how it works
                </a>
              </div>

              {/* Proof row */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm text-foreground-muted lg:justify-start">
                {["Built for High School", "Free to start", "No credit card"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — mascot with radial primary glow */}
            <div className="relative flex items-center justify-center lg:justify-end">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[110%] w-[110%] -translate-x-1/2 -translate-y-1/2"
                style={{
                  background:
                    "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-primary) 22%, transparent) 0%, color-mix(in srgb, var(--color-primary) 8%, transparent) 45%, transparent 70%)",
                }}
              />
              <Image
                src="/brand/genie-mascot.png"
                alt="The Plan with Genie mascot"
                width={512}
                height={512}
                priority
                className="relative h-auto w-full max-w-xs drop-shadow-[0_30px_48px_rgba(20,18,21,0.14)] sm:max-w-sm lg:max-w-md"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works — V3 strip, per DESIGN.md §10 ──────────── */}
      <section id="how-it-works" className="border-y border-border bg-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="grid items-start gap-10 sm:grid-cols-3 sm:gap-12">
            {HOW_IT_WORKS_STEPS.map((s) => (
              <div key={s.n} className="flex items-start gap-5">
                <div
                  className="shrink-0 text-[28px] font-bold leading-none tracking-[-0.02em] text-primary"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {s.n}
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold tracking-[-0.005em] text-foreground">{s.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why Genie? ──────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">The problem</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Why students need Genie
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                title: "Course maze",
                desc: "300+ options, complex prerequisites, and one wrong choice in 9th grade can block advanced classes in 12th.",
                emoji: "🔀",
              },
              {
                title: "Graduation surprises",
                desc: "Without continuous tracking, students discover credit gaps when it's too late to fix them.",
                emoji: "⚠️",
              },
              {
                title: "Everyone's in the dark",
                desc: "Parents ask the same questions over and over. There's no shared source of truth.",
                emoji: "🔦",
              },
            ].map((item, i) => (
              <div key={i} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
                <span className="text-3xl leading-none">{item.emoji}</span>
                <h3 className="mt-3 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────── */}
      <section className="bg-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Features</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Everything you&rsquo;d wish for
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Built specifically for high school academic planning — from course selection to graduation day.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={i} className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${f.color}`}>
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing (feature-flagged) ───────────────────────────── */}
      {HOME_FEATURES.showPricing && (
        <section id="pricing">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">Pricing</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Simple, transparent pricing
              </h2>
              <p className="mt-3 text-muted-foreground">Start free. Upgrade when you need more.</p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {PRICING_TIERS.map((tier) => (
                <div key={tier.name} className={`flex flex-col rounded-2xl border p-6 ${tier.highlight ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20" : "border-border"}`}>
                  {tier.highlight && <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Most popular</p>}
                  <h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-extrabold text-foreground">{tier.price}</span>
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  </div>
                  <ul className="mt-6 space-y-2.5">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                        <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup"
                    className={`mt-auto block min-h-[44px] rounded-xl py-2.5 text-center text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      tier.highlight
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary-hover"
                        : "border border-border text-foreground hover:bg-muted"
                    }`}>
                    {tier.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Testimonials (feature-flagged) ──────────────────────── */}
      {HOME_FEATURES.showTestimonials && (
        <section className="bg-surface-muted">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">Testimonials</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Loved by students and families
              </h2>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex gap-1 text-warning">
                    {[...Array(5)].map((_, j) => (
                      <svg key={j} aria-hidden="true" className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z" /></svg>
                    ))}
                  </div>
                  <p className="mt-4 flex-1 text-sm italic leading-relaxed text-foreground">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── FAQ ─────────────────────────────────────────────────── */}
      <section id="faq">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">FAQ</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Common questions
            </h2>
          </div>

          <div className="mt-10 divide-y divide-border rounded-2xl border border-border">
            {FAQS.map((faq, i) => (
              <div key={i}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full min-h-[44px] items-center justify-between px-6 py-5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="text-sm font-medium text-foreground pr-4">{faq.q}</span>
                  <svg aria-hidden="true" className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-in-out ${openFaq === i ? "rotate-45" : ""}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
                <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${openFaq === i ? "max-h-48" : "max-h-0"}`}>
                  <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Ready?</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            Make the wish. Map the path.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Free during early access. Sign up in under a minute.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup"
              className="group flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-all sm:w-auto">
              Get Started Free
              <svg aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <a href="#faq"
              className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-border px-8 py-3.5 text-base font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors sm:w-auto">
              Read the FAQ
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
