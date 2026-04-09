"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HOME_FEATURES } from "@/config/homepage";
import { SapsLogo } from "@/components/ui/saps-logo";

const NAV_LINKS = [
  { label: "About", href: "/about" },
  ...(HOME_FEATURES.showPricing ? [{ label: "Pricing", href: "/#pricing" }] : []),
  { label: "FAQ", href: "/#faq" },
  ...(HOME_FEATURES.showContactPage ? [{ label: "Contact", href: "/contact" }] : []),
];


export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 focus-ring">
            <SapsLogo size="md" />
            <span className="text-lg font-bold text-foreground">SAPS</span>
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
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2">
                <SapsLogo size="sm" />
                <span className="font-bold text-foreground">SAPS</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Student Academic Planning System. Built by a Stevenson High School student.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Product</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-ring">About</Link></li>
                {HOME_FEATURES.showPricing && (
                  <li><Link href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-ring">Pricing</Link></li>
                )}
                <li><Link href="/#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-ring">FAQ</Link></li>
                <li><Link href="/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-ring">Get Started</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Legal</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-ring">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-ring">Privacy Policy</Link></li>
                {HOME_FEATURES.showContactPage && (
                  <li><Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-ring">Contact Us</Link></li>
                )}
              </ul>
            </div>

            {/* Connect */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Connect</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Currently supporting Stevenson High School.{" "}
                <Link href="/signup" className="text-primary hover:underline transition-colors focus-ring">More schools coming soon!</Link>
              </p>
            </div>
          </div>

          <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} SAPS. All rights reserved. Not affiliated with Adlai E. Stevenson High School.
          </div>
        </div>
      </footer>
    </div>
  );
}
