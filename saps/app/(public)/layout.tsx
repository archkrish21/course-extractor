"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HOME_FEATURES } from "@/config/homepage";
import { SapsLogo } from "@/components/ui/saps-logo";
import { GenieWordmark } from "@/components/ui/genie-wordmark";
import { SupportLink } from "@/components/ui/support-link";

const NAV_LINKS = [
  { label: "About", href: "/about" },
  ...(HOME_FEATURES.showPricing ? [{ label: "Pricing", href: "/#pricing" }] : []),
  { label: "FAQ", href: "/#faq" },
  ...(HOME_FEATURES.showContactPage ? [{ label: "Contact", href: "/contact" }] : []),
];

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/plan_with_genie/", icon: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" },
  { label: "Facebook", href: "#", icon: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" },
];


export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 focus-ring">
            <SapsLogo size="md" />
            <GenieWordmark size="md" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link key={link.href} href={link.href}
                  className={`text-sm font-medium transition-colors focus-ring ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-ring sm:inline-flex items-center min-h-[44px]">
              Sign in
            </Link>
            <Link href="/signup"
              className="inline-flex items-center rounded-lg bg-primary px-5 min-h-[44px] text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors focus-ring">
              Get Started Free
            </Link>

            {/* Mobile menu button */}
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-ring md:hidden"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        <div id="mobile-nav" className={`${mobileMenuOpen ? "" : "hidden"} border-t border-border bg-card px-4 pb-4 pt-2 md:hidden`}>
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-ring">
                {link.label}
              </Link>
            ))}
            <Link href="/login"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-ring">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer — per DESIGN.md §10.4 */}
      <footer className="bg-accent-soft">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          {/* Brand row — wordmark top, subtitle below */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <SapsLogo size="md" />
              <GenieWordmark size="md" />
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-foreground-muted">
              Built by a Stevenson High School student. Currently supporting Stevenson —{" "}
              <Link
                href="/request-school"
                className="text-primary underline-offset-2 hover:underline focus-ring"
              >
                more schools coming soon
              </Link>
              .
            </p>
          </div>

          {/* 4 columns */}
          <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">Product</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/about" className="text-sm text-foreground-muted hover:text-foreground transition-colors focus-ring">About</Link></li>
                {HOME_FEATURES.showPricing && (
                  <li><Link href="/#pricing" className="text-sm text-foreground-muted hover:text-foreground transition-colors focus-ring">Pricing</Link></li>
                )}
                <li><Link href="/#faq" className="text-sm text-foreground-muted hover:text-foreground transition-colors focus-ring">FAQ</Link></li>
                <li><Link href="/signup" className="text-sm text-foreground-muted hover:text-foreground transition-colors focus-ring">Get Started</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">Resources</p>
              <ul className="mt-3 space-y-2">
                <li><SupportLink /></li>
                {HOME_FEATURES.showContactPage && (
                  <li><Link href="/contact" className="text-sm text-foreground-muted hover:text-foreground transition-colors focus-ring">Contact</Link></li>
                )}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">Connect</p>
              <div className="mt-3 flex gap-2">
                {SOCIAL_LINKS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:bg-background/40 hover:text-foreground transition-colors focus-ring"
                  >
                    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d={s.icon} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">Legal</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/terms" className="text-sm text-foreground-muted hover:text-foreground transition-colors focus-ring">Terms</Link></li>
                <li><Link href="/privacy" className="text-sm text-foreground-muted hover:text-foreground transition-colors focus-ring">Privacy</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar — tagline left, disclaimer right */}
          <div className="mt-8 flex flex-col gap-2 border-t border-border/60 pt-5 text-xs text-foreground-muted sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {new Date().getFullYear()} Plan with Genie · Academic planning, granted.</p>
            <p>Not affiliated with any school or school district.</p>
          </div>

        </div>
      </footer>
    </div>
  );
}
