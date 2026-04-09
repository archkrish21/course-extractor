import Link from "next/link";
import { SapsLogo } from "@/components/ui/saps-logo";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-40 flex flex-col items-center justify-center bg-muted py-4 border-b border-border/40">
        <Link href="/" className="flex flex-col items-center gap-2 hover:opacity-90 transition-opacity">
          <SapsLogo size="lg" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">SAPS</h1>
          <p className="text-sm text-muted-foreground">Student Academic Planning System</p>
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center">
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>&middot;</span>
          <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
          <span>&middot;</span>
          <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
