"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HOME_FEATURES } from "@/config/homepage";

// ── Data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "300+", label: "Courses" },
  { value: "37", label: "Grad Requirements" },
  { value: "4", label: "Year Planning" },
  { value: "Free", label: "To Start" },
];

const FEATURES = [
  {
    title: "4-Year Course Planner",
    desc: "Drag, drop, and plan across all four years. See your entire academic path at a glance with a visual semester grid.",
    icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5",
    color: "bg-primary/10 text-primary",
  },
  {
    title: "GPA & Grade Tracking",
    desc: "Real-time weighted and unweighted GPA. Projected grades, what-if scenarios, and semester-by-semester trends.",
    icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
    color: "bg-success/10 text-success",
  },
  {
    title: "Graduation Progress",
    desc: "Track 37 requirements across 4 categories. Visual progress bars show earned, planned, and remaining credits.",
    icon: "M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z",
    color: "bg-warning/10 text-warning",
  },
  {
    title: "Prerequisite Intelligence",
    desc: "Automatic chain validation catches scheduling conflicts before they happen. Never get blocked from a course again.",
    icon: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244",
    color: "bg-ap/10 text-ap",
  },
  {
    title: "Family & Counselor Access",
    desc: "Link parents, guardians, and counselors. Everyone stays informed with shared visibility into plans and progress.",
    icon: "M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z",
    color: "bg-primary/10 text-primary",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Create your account",
    desc: "Sign up in under a minute. No credit card required.",
    icon: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  },
  {
    step: "02",
    title: "Build your plan",
    desc: "Pick a template or start from scratch. Add courses to your 4-year grid.",
    icon: "M12 4.5v15m7.5-7.5h-15",
  },
  {
    step: "03",
    title: "Track your progress",
    desc: "Monitor grades, GPA, and graduation requirements as you go.",
    icon: "M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941",
  },
];

const FAQS = [
  { q: "Is Genie free?", a: "Yes! Genie is completely free during early access. Create your account and start planning today — no credit card required." },
  { q: "Is Genie affiliated with Stevenson High School?", a: "No. Plan with Genie is an independent tool built by a Stevenson student. It is not affiliated with, endorsed by, or sponsored by Adlai E. Stevenson High School." },
  { q: "How is my data protected?", a: "Your data is encrypted in transit, stored securely, and never sold to third parties. You can delete your account and all data at any time." },
  { q: "Can my parents see my grades?", a: "Only if you invite them. Parents and guardians can be linked to your account with view access. You control who sees your data." },
  { q: "How much does Genie cost?", a: "Right now, Genie is 100% free to use. We're committed to growing with our users and will soon be introducing exciting new tools and enhancements designed to help you achieve even more." },
  { q: "Can I use Genie if I go to a different school?", a: "Genie currently supports Stevenson High School. We're expanding to more schools soon — request yours during signup!" },
  { q: "Who built Genie?", a: "Genie was built by a junior at Stevenson High School who wanted a better way to plan courses and track academic progress." },
];

const TESTIMONIALS = [
  { name: "Maya S.", role: "Sophomore", quote: "Genie helped me map out my AP track through senior year. I can finally see how everything connects." },
  { name: "David P.", role: "Parent", quote: "As a parent, I love being able to see my son's plan and graduation progress without having to ask constantly." },
  { name: "Ms. Chen", role: "Counselor", quote: "Having a shared view of the student's 4-year plan makes our advising sessions so much more productive." },
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
      {/* ─── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:pt-28">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Left — headline + CTAs */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Free during early access
              </div>

              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Plan Your 4-Year
                <br />
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent [-webkit-text-fill-color:transparent]">
                  High School Journey
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
                Track courses, grades, and GPA. Monitor graduation requirements. Keep parents and counselors in the loop — all in one place.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link href="/signup"
                  className="group flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-all sm:w-auto">
                  Get Started Free
                  <svg aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <a href="#how-it-works"
                  className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-border px-8 py-3.5 text-base font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors sm:w-auto">
                  See How It Works
                </a>
              </div>
            </div>

            {/* Right — mascot */}
            <div className="flex justify-center lg:justify-end">
              <Image
                src="/brand/genie-mascot.png"
                alt="The Plan with Genie mascot"
                width={512}
                height={512}
                priority
                className="h-auto w-full max-w-xs sm:max-w-sm lg:max-w-md"
              />
            </div>
          </div>

          {/* Stats bar */}
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-4 sm:p-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-extrabold text-foreground sm:text-3xl">{s.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-primary/3 blur-3xl" />
        </div>
      </section>

      {/* ─── Why Genie? ──────────────────────────────────────────── */}
      <section className="bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">The Problem</p>
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
                desc: "Parents ask the same questions. Counselors lack context. There's no shared source of truth.",
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
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Features</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Everything you need to plan ahead
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

      {/* ─── How It Works ────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">How It Works</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Get started in 3 simple steps
            </h2>
          </div>

          <div className="mx-auto mt-14 max-w-3xl">
            {STEPS.map((s, i) => (
              <div key={s.step} className={`flex gap-6 ${i < STEPS.length - 1 ? "pb-12" : ""}`}>
                {/* Step indicator + line */}
                <div className="flex flex-col items-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25">
                    {s.step}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="mt-2 h-full w-px bg-border" />
                  )}
                </div>
                {/* Content */}
                <div className="pb-2 pt-1">
                  <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/signup"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-all">
              Create Your Free Account
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
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
                  {tier.highlight && <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Most Popular</p>}
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
        <section className="bg-muted/40">
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
            Start planning your future today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join students who are taking control of their high school academic journey. It's free, fast, and takes under a minute.
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
              Read FAQ
            </a>
          </div>
        </div>
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute right-1/4 top-1/2 h-[250px] w-[400px] -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/3 blur-3xl" />
        </div>
      </section>
    </>
  );
}
