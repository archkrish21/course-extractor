import Link from "next/link";
import { BackButton } from "@/components/back-button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Plan with Genie",
};

/**
 * Terms of Service page.
 * [LEGAL COUNSEL REQUIRED] Replace placeholder content with attorney-drafted terms.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective: April 6, 2026 &middot; Version 1.0</p>

      <div className="mt-8 space-y-6 text-base leading-relaxed text-foreground">
        <section>
          <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
          <p className="mt-2">
            By creating an account or using Plan with Genie, you agree to these Terms of Service.
            You must be at least 13 years old to use this service. If you are between 13 and 17 years old, you represent
            that your parent or legal guardian is aware of your use of this service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Description of Service</h2>
          <p className="mt-2">
            Plan with Genie is an academic planning tool that helps high school students plan 4-year course schedules, track grades
            and GPA, and monitor graduation requirements. Plan with Genie is <strong>not affiliated with, endorsed by, or sponsored
            by Adlai E. Stevenson High School</strong> or any educational institution. Course catalog data is sourced
            from publicly available information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. User Accounts and Roles</h2>
          <p className="mt-2">
            Plan with Genie supports two user roles: Student and Parent. You are responsible for maintaining the
            confidentiality of your account credentials and for all activities under your account. You agree to provide
            accurate information when creating your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. User Responsibilities</h2>
          <p className="mt-2">
            You are solely responsible for the accuracy of academic data you enter into Plan with Genie, including grades, course
            selections, and test scores. Plan with Genie does not verify this information with any school or institution.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Subscription and Payments</h2>
          <p className="mt-2">
            Plan with Genie offers free and paid subscription tiers. Paid subscriptions are processed through Stripe. By subscribing,
            you agree to Stripe's terms of service. Subscriptions auto-renew unless canceled before the renewal date.
            You may cancel at any time from your billing settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Intellectual Property</h2>
          <p className="mt-2">
            The Plan with Genie platform, including its design, code, and features, is owned by Plan with Genie. Academic data you enter
            belongs to you. Course catalog information is sourced from publicly available school publications.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Disclaimer of Warranties</h2>
          <p className="mt-2">
            Plan with Genie is provided "as is" without warranties of any kind. Plan with Genie is <strong>not a substitute for professional
            academic counseling</strong>. We do not guarantee course availability, schedule accuracy, or that following
            a plan will result in meeting graduation requirements. Always consult your school counselor for official
            academic guidance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Limitation of Liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, Plan with Genie shall not be liable for any indirect, incidental, special, or
            consequential damages arising from your use of the service, including but not limited to academic decisions
            made based on information provided by Plan with Genie.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Account Termination</h2>
          <p className="mt-2">
            You may delete your account at any time from Settings. We reserve the right to suspend or terminate accounts
            that violate these terms. Upon account deletion, your data will be permanently removed except for anonymized
            consent records retained for legal compliance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. Changes to Terms</h2>
          <p className="mt-2">
            We may update these Terms from time to time. When we do, we will notify you through the application and
            require you to review and accept the updated terms before continuing to use the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">11. Governing Law</h2>
          <p className="mt-2">
            These Terms are governed by the laws of the State of Illinois, United States. This service is intended for
            use within the United States.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">12. Contact</h2>
          <p className="mt-2">
            For questions about these Terms, contact us at <a href="mailto:planwithgenie@gmail.com" className="rounded text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">planwithgenie@gmail.com</a>.
          </p>
        </section>
      </div>

      <div className="mt-12 flex items-center justify-between border-t border-border pt-6 text-xs text-muted-foreground">
        <Link href="/privacy" className="rounded text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Privacy Policy</Link>
        <BackButton />
      </div>
    </div>
  );
}
