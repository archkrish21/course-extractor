import Link from "next/link";
import { SapsLogo } from "@/components/ui/saps-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-8">
      <Link href="/" className="mb-8 flex flex-col items-center gap-2 hover:opacity-90 transition-opacity">
        <SapsLogo size="xl" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">SAPS</h1>
        <p className="text-sm text-muted-foreground">Student Academic Planning System</p>
      </Link>

      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {children}
      </div>

      <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>&middot;</span>
        <a href="/terms" className="hover:text-foreground">Terms of Service</a>
        <span>&middot;</span>
        <a href="/privacy" className="hover:text-foreground">Privacy Policy</a>
      </div>
    </div>
  );
}
