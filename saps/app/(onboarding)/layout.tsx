import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { SapsLogo } from "@/components/ui/saps-logo";
import { GenieWordmark } from "@/components/ui/genie-wordmark";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Block re-entry: once a user has completed onboarding, bounce them to
  // the main app. Applies to students (post-onboarding) and non-student
  // roles (which never go through this flow). Unauthenticated visits are
  // left alone — the auth middleware handles those.
  const authUser = await getAuthenticatedUser();
  if (authUser) {
    const [row] = await db
      .select({
        onboardingCompletedAt: users.onboardingCompletedAt,
        profileSetupCompletedAt: users.profileSetupCompletedAt,
      })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);
    if (!row?.profileSetupCompletedAt) redirect("/profile-setup");
    if (row?.onboardingCompletedAt) redirect("/dashboard");
  }
  return (
    <div className="flex min-h-screen flex-col bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-40 flex flex-col items-center justify-center bg-muted py-4 border-b border-border/40">
        <Link href="/" className="flex flex-col items-center gap-2 hover:opacity-90 transition-opacity">
          <SapsLogo size="lg" />
          <GenieWordmark size="xl" />
          <p className="text-sm text-muted-foreground">Academic planning, granted.</p>
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
