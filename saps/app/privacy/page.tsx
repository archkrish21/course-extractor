import Link from "next/link";
import { BackButton } from "@/components/back-button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Plan with Genie",
};

/**
 * Privacy Policy page.
 * [LEGAL COUNSEL REQUIRED] Replace placeholder content with attorney-drafted policy.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective: April 6, 2026 &middot; Version 1.0</p>

      <div className="mt-8 space-y-6 text-base leading-relaxed text-foreground">
        <section>
          <h2 className="text-lg font-semibold">1. Information We Collect</h2>
          <p className="mt-2"><strong>Information you provide:</strong> Email address, date of birth, name, role (student/parent), grades, course selections, GPA goals, college targets, and test scores.</p>
          <p className="mt-2"><strong>Automatically collected:</strong> IP address, browser type, device information, and usage analytics.</p>
          <p className="mt-2"><strong>Payment information:</strong> Processed by Stripe. We do not store credit card numbers.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. How We Use Your Information</h2>
          <p className="mt-2">We use your information to: provide the academic planning service, calculate GPA and track graduation requirements, send transactional emails (invites, notifications), process payments, and improve the service.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Information Sharing</h2>
          <p className="mt-2">We share data with the following third-party services, solely for service operation:</p>
          <ul className="mt-2 ml-4 list-disc space-y-1">
            <li><strong>Stripe</strong> — Payment processing (email, name, payment method)</li>
            <li><strong>Resend</strong> — Transactional emails (email address)</li>
            <li><strong>Supabase</strong> — Authentication and database hosting (all user data)</li>
          </ul>
          <p className="mt-2">We do <strong>not sell</strong> your personal information to any third party.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Children's Privacy (COPPA)</h2>
          <p className="mt-2">
            Plan with Genie does not knowingly collect information from children under 13. Users must be at least 13 years old to
            create an account. Users aged 13-17 are minors; parents can monitor their academic data through the parent
            role within the same account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. FERPA Statement</h2>
          <p className="mt-2">
            Plan with Genie is <strong>not a school official</strong> and does not receive education records from Stevenson High School
            or any educational institution. All academic information in Plan with Genie is self-reported by users. Plan with Genie is not subject
            to FERPA as it does not access school systems or official student records.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Your Rights</h2>
          <p className="mt-2">You have the right to:</p>
          <ul className="mt-2 ml-4 list-disc space-y-1">
            <li><strong>Access</strong> — View all your data within the application</li>
            <li><strong>Correct</strong> — Edit your information at any time</li>
            <li><strong>Delete</strong> — Delete your account and all associated data from Settings</li>
            <li><strong>Export</strong> — Download a copy of your data before account deletion</li>
          </ul>
          <p className="mt-2">
            <strong>California residents (CCPA/CPRA):</strong> You have additional rights including the right to know what
            personal information is collected, the right to opt out of sale (we do not sell data), and the right to
            non-discrimination for exercising these rights.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Data Security</h2>
          <p className="mt-2">
            We protect your data using encryption in transit (HTTPS), secure database hosting via Supabase, and
            role-based access controls. However, no method of transmission or storage is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Data Retention</h2>
          <p className="mt-2">
            We retain your data for as long as your account is active. Upon account deletion, all personal data is
            permanently removed. Anonymized consent records are retained for legal compliance purposes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Cookies</h2>
          <p className="mt-2">
            Plan with Genie uses essential session cookies for authentication. We do not use advertising or tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. Changes to This Policy</h2>
          <p className="mt-2">
            We may update this Privacy Policy from time to time. When we do, we will notify you through the application
            and require you to review and accept the updated policy before continuing to use the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">11. Contact</h2>
          <p className="mt-2">
            For privacy-related questions or to exercise your data rights, contact us at{" "}
            <a href="mailto:planwithgenie@gmail.com" className="rounded text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">planwithgenie@gmail.com</a>.
          </p>
        </section>
      </div>

      <div className="mt-12 flex items-center justify-between border-t border-border pt-6 text-xs text-muted-foreground">
        <Link href="/terms" className="rounded text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Terms of Service</Link>
        <BackButton />
      </div>
    </div>
  );
}
