import Link from "next/link";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-40 flex flex-col items-center justify-center bg-muted py-4 border-b border-border/40">
        <Link href="/" className="flex flex-col items-center gap-2 hover:opacity-90 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <svg
              aria-hidden="true"
              className="h-6 w-6 text-primary-foreground"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"
              />
            </svg>
          </div>
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
          <a href="/terms" className="hover:text-foreground">Terms of Service</a>
          <span>&middot;</span>
          <a href="/privacy" className="hover:text-foreground">Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}
