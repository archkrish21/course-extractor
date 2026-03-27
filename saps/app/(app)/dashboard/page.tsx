"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";

interface DashboardPlan {
  id: string;
  name: string;
  status: string;
  isPrimary: boolean;
  courseCount: number;
}

export default function DashboardPage() {
  const { currentAccount, loading: accountLoading } = useAccount();
  const [showProfileBanner, setShowProfileBanner] = useState(true);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);
  const [primaryPlan, setPrimaryPlan] = useState<DashboardPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [claimCode, setClaimCode] = useState<string | null>(null);

  // Fetch primary plan info
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await apiFetch("/api/v1/plans");
        if (res.ok) {
          const data = await res.json();
          const plans: DashboardPlan[] = data.plans ?? data.data ?? data ?? [];
          const primary = plans.find((p) => p.isPrimary) ?? plans[0] ?? null;
          setPrimaryPlan(primary);
          if (plans.length === 0) {
            setShowOnboardingBanner(true);
          }
        }
      } catch {
        // Silently fail — dashboard still shows placeholder data
      } finally {
        setPlanLoading(false);
      }
    }

    // Also check onboarding state
    async function checkOnboarding() {
      try {
        const res = await apiFetch("/api/v1/profile");
        if (res.ok) {
          const data = await res.json();
          const profile = data.profile ?? data;
          if (profile?.yearEndTransitionState === "pending") {
            setShowOnboardingBanner(true);
          }
        }
      } catch {
        // Ignore
      }
    }

    // Fetch claim code if account is unclaimed (parent viewing)
    async function fetchClaimCode() {
      if (!currentAccount || currentAccount.isClaimed) return;
      try {
        const res = await apiFetch("/api/v1/accounts/claim-code");
        if (res.ok) {
          const data = await res.json();
          setClaimCode(data.claim_code ?? data.claimCode ?? null);
        }
      } catch {
        // Ignore
      }
    }

    if (!accountLoading) {
      fetchDashboardData();
      checkOnboarding();
      fetchClaimCode();
    }
  }, [accountLoading, currentAccount]);

  const studentName = currentAccount?.studentName ?? "Student";

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Welcome to {studentName}&apos;s account
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {currentAccount?.gradeLevel
          ? `Grade ${currentAccount.gradeLevel} \u00b7 Class of ${currentAccount.graduationYear}`
          : "Dashboard"}
      </p>

      {/* Unclaimed account banner — parent viewing */}
      {currentAccount && !currentAccount.isClaimed && (
        <div
          className="mb-6 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-light p-4 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-warning"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <div>
              <p className="font-semibold text-warning">
                Waiting for {studentName} to claim this account
              </p>
              <p className="mt-1 text-sm text-foreground/70">
                Share this claim code with {studentName} so they can take ownership of their account.
              </p>
              {claimCode && (
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded-lg bg-background px-3 py-1.5 font-mono text-base font-bold tracking-widest text-foreground">
                    {claimCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(claimCode);
                    }}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label="Copy claim code to clipboard"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Complete your onboarding banner */}
      {showOnboardingBanner && (
        <div
          className="mb-6 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-light p-4 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-warning"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <div>
              <p className="font-semibold text-warning">Complete your onboarding</p>
              <p className="text-sm text-foreground/70">
                Finish setting up your profile and create your first plan to get the most out of SAPS.
              </p>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <Link href="/onboarding">
              <Button size="sm">Finish setup</Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowOnboardingBanner(false)}
              aria-label="Dismiss onboarding banner"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Complete your profile banner */}
      {showProfileBanner && !showOnboardingBanner && currentAccount?.isClaimed !== false && (
        <div
          className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-light p-4 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
              />
            </svg>
            <div>
              <p className="font-semibold text-primary">Complete your profile</p>
              <p className="text-sm text-primary/80">
                Add your grade history and select a plan template to get personalized recommendations.
              </p>
            </div>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <Link href="/onboarding">
              <Button size="sm">Complete setup</Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowProfileBanner(false)}
              aria-label="Dismiss profile completion banner"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Primary Plan Summary Card */}
      <div className="mb-6">
        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                  />
                </svg>
              </div>
              <div>
                {planLoading ? (
                  <p className="text-sm text-muted-foreground">Loading plan...</p>
                ) : primaryPlan ? (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {primaryPlan.name}
                      </p>
                      <Badge variant="success" className="text-[10px]">
                        Primary
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {primaryPlan.courseCount} course{primaryPlan.courseCount !== 1 ? "s" : ""} planned
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      No active plan
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Create a plan to start tracking your courses.
                    </p>
                  </>
                )}
              </div>
            </div>
            <Link href="/planner">
              <Button size="sm" variant={primaryPlan ? "outline" : "default"}>
                {primaryPlan ? "Open Planner" : "Create Plan"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard grid */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {/* GPA Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-foreground">GPA Summary</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-4">
              <div>
                <p className="text-3xl font-bold text-foreground">--</p>
                <p className="text-sm text-muted-foreground">Cumulative GPA</p>
              </div>
              <div className="h-8 w-px bg-border" aria-hidden="true" />
              <div>
                <p className="text-3xl font-bold text-muted-foreground">--</p>
                <p className="text-sm text-muted-foreground">Projected GPA</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Enter your grades to see your GPA calculations.
            </p>
          </CardContent>
        </Card>

        {/* Graduation Progress */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-success"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-foreground">Graduation Progress</h2>
            </div>
          </CardHeader>
          <CardContent>
            {/* Progress bar placeholder */}
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Credits completed</span>
              <span className="font-medium text-foreground">-- / -- credits</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={0} aria-valuemin={0} aria-valuemax={100} aria-label="Graduation credit progress">
              <div className="h-full rounded-full bg-success" style={{ width: "0%" }} />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Build your course plan to track graduation requirements.
            </p>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-warning"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                />
              </svg>
              <h2 className="text-lg font-semibold text-foreground">Active Alerts</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-4 text-center">
              <svg
                aria-hidden="true"
                className="mb-2 h-8 w-8 text-muted-foreground/40"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
              <p className="text-sm text-muted-foreground">No active alerts</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Alerts will appear here when your plan needs attention.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Link href="/planner">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Open Planner
                </Button>
              </Link>
              <Link href="/courses">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  Browse Courses
                </Button>
              </Link>
              <Link href="/grades">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                  Enter Grades
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
