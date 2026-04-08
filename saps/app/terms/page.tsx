"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Terms of Service page.
 * [LEGAL COUNSEL REQUIRED] Replace placeholder content with attorney-drafted terms.
 */
export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-prose px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective: April 6, 2026 &middot; Version 1.0</p>

      <div className="mt-8 space-y-6 text-base leading-relaxed text-foreground">
        <section>
          <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
          <p className="mt-2">
            By creating an account or using SAPS (Student Academic Planning System), you agree to these Terms of Service.
            You must be at least 13 years old to use this service. If you are between 13 and 17 years old, you represent
            that your parent or legal guardian is aware of your use of this service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Description of Service</h2>
          <p className="mt-2">
            SAPS is an academic planning tool that helps high school students plan 4-year course schedules, track grades
            and GPA, and monitor graduation requirements. SAPS is <strong>not affiliated with, endorsed by, or sponsored
            by Adlai E. Stevenson High School</strong> or any educational institution. Course catalog data is sourced
            from publicly available information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. User Accounts and Roles</h2>
          <p className="mt-2">
            SAPS supports three user roles: Student, Parent, and Counselor. You are responsible for maintaining the
            confidentiality of your account credentials and for all activities under your account. You agree to provide
            accurate information when creating your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. User Responsibilities</h2>
          <p className="mt-2">
            You are solely responsible for the accuracy of academic data you enter into SAPS, including grades, course
            selections, and test scores. SAPS does not verify this information with any school or institution.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Subscription and Payments</h2>
          <p className="mt-2">
            SAPS offers free and paid subscription tiers. Paid subscriptions are processed through Stripe. By subscribing,
            you agree to Stripe's terms of service. Subscriptions auto-renew unless canceled before the renewal date.
            You may cancel at any time from your billing settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Intellectual Property</h2>
          <p className="mt-2">
            The SAPS platform, including its design, code, and features, is owned by SAPS. Academic data you enter
            belongs to you. Course catalog information is sourced from publicly available school publications.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Disclaimer of Warranties</h2>
          <p className="mt-2">
            SAPS is provided "as is" without warranties of any kind. SAPS is <strong>not a substitute for professional
            academic counseling</strong>. We do not guarantee course availability, schedule accuracy, or that following
            a plan will result in meeting graduation requirements. Always consult your school counselor for official
            academic guidance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Limitation of Liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, SAPS shall not be liable for any indirect, incidental, special, or
            consequential damages arising from your use of the service, including but not limited to academic decisions
            made based on information provided by SAPS.
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
            For questions about these Terms, contact us at <a href="mailto:legal@saps.app" className="text-primary hover:underline">legal@saps.app</a>.
          </p>
        </section>
      </div>

      <div className="mt-12 flex items-center justify-between border-t border-border pt-6 text-xs text-muted-foreground">
        <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        <button
          type="button"
          onClick={() => {
            if (window.opener || window.history.length <= 2) {
              window.close();
            }
            router.back();
          }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back
        </button>
      </div>
    </div>
  );
}
