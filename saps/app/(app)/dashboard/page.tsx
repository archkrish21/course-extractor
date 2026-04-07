"use client";

import React, { useState, useEffect } from "react";
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
  totalCredits?: number;
}

interface GpaData {
  cumulative: {
    unweighted: number | null;
    weighted: number | null;
    credits?: number;
    courses?: number;
  };
  projected: {
    unweighted: number | null;
    weighted: number | null;
    credits?: number;
    courses?: number;
  };
  plan?: {
    totalCredits: number;
    earnedCredits: number;
    totalCourses: number;
  };
  hasGrades: boolean;
}

interface RequirementItem {
  name: string;
  status: "met" | "in_progress" | "gap";
  earnedCredits: number;
  plannedCredits?: number;
  requiredCredits: number;
}

interface RequirementGroupData {
  group: string;
  label: string;
  isOptIn: boolean;
  enabled: boolean;
  requirements: Array<{
    name: string;
    status: string;
    earnedCredits: number;
    plannedCredits: number;
    requiredCredits: number;
    notes: string | null;
    evaluationType?: string;
    metadata?: Record<string, unknown>;
  }>;
}

interface RequirementsData {
  totalEarned: number;
  totalPlanned?: number;
  totalRequired: number;
  requirements: RequirementItem[];
  groups?: RequirementGroupData[];
  gpaWaiverWarnings?: string[];
  honorsStatus?: { tier: string; weightedGpa: number; totalCredits: number } | null;
}

export default function DashboardPage() {
  const { currentAccount, loading: accountLoading, userFirstName, userLastName } = useAccount();
  const [showProfileBanner, setShowProfileBanner] = useState(true);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);
  const [primaryPlan, setPrimaryPlan] = useState<DashboardPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [claimCode, setClaimCode] = useState<string | null>(null);

  // GPA state
  const [gpaData, setGpaData] = useState<GpaData | null>(null);
  const [gpaLoading, setGpaLoading] = useState(true);
  const [gpaError, setGpaError] = useState(false);

  // Requirements state
  const [reqData, setReqData] = useState<RequirementsData | null>(null);
  const [reqLoading, setReqLoading] = useState(true);
  const [reqError, setReqError] = useState(false);
  const [showAllReqs, setShowAllReqs] = useState(false);

  // Warnings state
  const [warningCount, setWarningCount] = useState(0);
  const [warningMessages, setWarningMessages] = useState<string[]>([]);

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

          // Fetch warnings for the primary plan
          if (primary) {
            try {
              const [valRes, coursesRes] = await Promise.all([
                apiFetch(`/api/v1/plans/${primary.id}/validate`),
                apiFetch(`/api/v1/plans/${primary.id}/courses`),
              ]);
              const warnings: string[] = [];

              // API violations (prerequisite, duplicate, etc.) — formatted consistently
              if (valRes.ok) {
                const valJson = await valRes.json();
                const valData = valJson.data ?? valJson;
                const courseViolations = valData.courseViolations ?? valData.violations ?? [];
                if (Array.isArray(courseViolations)) {
                  for (const cv of courseViolations) {
                    const code = cv.courseCode ?? "";
                    const innerViolations = cv.violations ?? [cv];
                    for (const v of innerViolations) {
                      warnings.push(`${code ? `${code} — ` : ""}${v.message ?? "Validation issue"}`);
                    }
                  }
                }
              }

              setWarningCount(warnings.length);
              setWarningMessages(warnings);
            } catch {
              // Silent — warnings not critical for dashboard
            }
          }
        }
      } catch {
        // Silently fail — dashboard still shows placeholder data
      } finally {
        setPlanLoading(false);
      }
    }

    // Fetch GPA data
    async function fetchGpa() {
      try {
        const res = await apiFetch("/api/v1/gpa");
        if (res.ok) {
          const json = await res.json();
          setGpaData(json.data ?? json);
        } else {
          setGpaError(true);
        }
      } catch {
        setGpaError(true);
      } finally {
        setGpaLoading(false);
      }
    }

    // Fetch graduation requirements
    async function fetchRequirements() {
      try {
        const res = await apiFetch("/api/v1/requirements");
        if (res.ok) {
          const json = await res.json();
          const data = json.data ?? json;
          setReqData({
            totalEarned: data.totalEarned ?? data.total_earned ?? 0,
            totalPlanned: data.totalPlanned ?? data.total_planned ?? 0,
            totalRequired: data.totalRequired ?? data.total_required ?? 45,
            requirements: (data.requirements ?? []).map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (r: any) => ({
                name: r.name,
                status: r.status,
                earnedCredits: r.earnedCredits ?? r.earned_credits ?? 0,
                plannedCredits: r.plannedCredits ?? r.planned_credits ?? 0,
                requiredCredits: r.requiredCredits ?? r.required_credits ?? 0,
              })
            ),
            groups: data.groups ?? [],
            gpaWaiverWarnings: data.gpaWaiverWarnings ?? [],
            honorsStatus: data.honorsStatus ?? null,
          });
        } else {
          setReqError(true);
        }
      } catch {
        setReqError(true);
      } finally {
        setReqLoading(false);
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
      fetchGpa();
      fetchRequirements();
      checkOnboarding();
      fetchClaimCode();
    }
  }, [accountLoading, currentAccount]);

  const displayName = [userFirstName, userLastName].filter(Boolean).join(" ") || currentAccount?.studentName || "Student";

  // Helpers
  const formatGpa = (val: number | null | undefined) =>
    val != null ? val.toFixed(2) : "--";

  const reqEarnedPct = reqData
    ? Math.min(100, Math.round((reqData.totalEarned / reqData.totalRequired) * 100))
    : 0;
  const reqPlannedPct = reqData
    ? Math.min(100 - reqEarnedPct, Math.round(((reqData.totalPlanned ?? 0) / reqData.totalRequired) * 100))
    : 0;

  const visibleReqs =
    reqData && !showAllReqs
      ? reqData.requirements.slice(0, 5)
      : reqData?.requirements ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Welcome, {displayName}
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
                Waiting for {currentAccount?.studentName ?? "the student"} to claim this account
              </p>
              <p className="mt-1 text-sm text-foreground/70">
                Share this claim code with {currentAccount?.studentName ?? "the student"} so they can take ownership of their account.
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

      {/* Dashboard grid */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {/* GPA Summary */}
        <Card className="flex h-full flex-col md:order-2">
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
          <CardContent className="flex-1">
            {gpaLoading ? (
              /* Loading skeleton */
              <div className="animate-pulse space-y-3">
                <div className="flex items-baseline gap-4">
                  <div>
                    <div className="h-9 w-16 rounded bg-muted" />
                    <div className="mt-1 h-4 w-24 rounded bg-muted" />
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <div className="h-9 w-16 rounded bg-muted" />
                    <div className="mt-1 h-4 w-24 rounded bg-muted" />
                  </div>
                </div>
                <div className="h-4 w-32 rounded bg-muted" />
              </div>
            ) : gpaError ? (
              /* Error state */
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Unable to load GPA data.
                </p>
                <Link href="/transcript">
                  <Button size="sm" variant="outline" className="mt-2">
                    View Transcript
                  </Button>
                </Link>
              </div>
            ) : gpaData && gpaData.hasGrades ? (
              /* Live GPA data */
              <>
                <div className="flex items-baseline gap-4">
                  <div>
                    <p className="text-3xl font-bold text-foreground">
                      {formatGpa(gpaData.cumulative.unweighted)}
                    </p>
                    <p className="text-sm text-muted-foreground">Unweighted</p>
                  </div>
                  <div className="h-8 w-px bg-border" aria-hidden="true" />
                  <div>
                    <p className="text-3xl font-bold text-foreground">
                      {formatGpa(gpaData.cumulative.weighted)}
                    </p>
                    <p className="text-sm text-muted-foreground">Weighted</p>
                  </div>
                </div>
                {/* Projected GPA — only show if different from cumulative */}
                {gpaData.projected.unweighted != null &&
                  gpaData.cumulative.unweighted != null &&
                  gpaData.projected.unweighted.toFixed(2) !==
                    gpaData.cumulative.unweighted.toFixed(2) && (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="default" className="text-xs">
                        Projected
                      </Badge>
                      <span className="text-sm font-medium text-foreground">
                        {formatGpa(gpaData.projected.unweighted)}
                        {gpaData.projected.weighted != null && (
                          <span className="text-muted-foreground">
                            {" "}
                            / {formatGpa(gpaData.projected.weighted)} W
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                <div className="mt-4">
                  <Link href="/transcript">
                    <Button size="sm" variant="outline">
                      View Transcript
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              /* No grades entered */
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
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                  />
                </svg>
                <p className="text-sm font-medium text-foreground">
                  No grades entered
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter your grades to see GPA calculations.
                </p>
                <Link href="/transcript" className="mt-3">
                  <Button size="sm">View Transcript</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Academic Progress */}
        <Card className="flex h-full flex-col md:order-5">
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
              <h2 className="text-lg font-semibold text-foreground">
                Academic Progress
              </h2>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {reqLoading ? (
              /* Loading skeleton */
              <div className="animate-pulse space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-28 rounded bg-muted" />
                  <div className="h-4 w-20 rounded bg-muted" />
                </div>
                <div className="h-3 w-full rounded-full bg-muted" />
                <div className="space-y-2 pt-2">
                  <div className="h-4 w-40 rounded bg-muted" />
                  <div className="h-4 w-36 rounded bg-muted" />
                  <div className="h-4 w-32 rounded bg-muted" />
                </div>
              </div>
            ) : !primaryPlan ? (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">Create a plan to track academic progress.</p>
                <Link href="/planner" className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary-hover">
                  Go to Planner
                </Link>
              </div>
            ) : reqError ? (
              /* Error state */
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Unable to load graduation requirements.
                </p>
                <Link href="/planner">
                  <Button size="sm" variant="outline" className="mt-2">
                    Open Planner
                  </Button>
                </Link>
              </div>
            ) : reqData ? (
              (() => {
                const groups = (reqData.groups ?? []).filter((g) => !g.isOptIn || g.enabled);
                return (
                  <>
                    {/* Per-group summary with segmented bars */}
                    <div className="space-y-3">
                      {groups.map((g) => {
                        let earned = 0, planned = 0, gaps = 0;
                        for (const r of g.requirements) {
                          if (r.evaluationType === "course_match") {
                            const e = r.earnedCredits ?? 0, p = r.plannedCredits ?? 0;
                            if (e >= r.requiredCredits) earned++;
                            else if (e + p >= r.requiredCredits) planned++;
                            else gaps++;
                          } else {
                            if (r.status === "met" || r.status === "completed") earned++;
                            else if (r.status === "in_progress") planned++;
                            else gaps++;
                          }
                        }
                        const total = g.requirements.length;
                        const ePct = total > 0 ? Math.round((earned / total) * 100) : 0;
                        const pPct = total > 0 ? Math.min(100 - ePct, Math.round((planned / total) * 100)) : 0;

                        return (
                          <div key={g.group}>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">{g.label}</p>
                              <div className="flex items-center gap-1 text-[10px]">
                                {earned > 0 && <span className="font-semibold text-success">{earned}</span>}
                                {planned > 0 && <span className="font-semibold text-primary">{planned}</span>}
                                {gaps > 0 && <span className="font-semibold text-destructive">{gaps}</span>}
                                <span className="text-muted-foreground">/ {total}</span>
                              </div>
                            </div>
                            <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              {ePct > 0 && <div className="h-full bg-success" style={{ width: `${ePct}%` }} />}
                              {pPct > 0 && <div className="h-full bg-primary/50" style={{ width: `${pPct}%` }} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> Earned</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/50" /> Planned</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/30" /> Remaining</span>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <Link href="/progress">
                        <Button size="sm" variant="outline">
                          View Progress
                        </Button>
                      </Link>
                    </div>
                  </>
                );
              })()
            ) : null}
          </CardContent>
        </Card>

        {/* Active Plan Summary */}
        <Card className="flex h-full flex-col md:order-1">
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
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                />
              </svg>
              <h2 className="text-lg font-semibold text-foreground">
                Active Plan
              </h2>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {planLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-5 w-36 rounded bg-muted" />
                <div className="h-4 w-28 rounded bg-muted" />
              </div>
            ) : primaryPlan ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {primaryPlan.name}
                      </p>
                      <Badge variant="success" className="text-[10px]">
                        Primary
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {gpaData?.plan?.totalCourses ?? primaryPlan.courseCount} course{(gpaData?.plan?.totalCourses ?? primaryPlan.courseCount) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Link href="/planner">
                    <Button size="sm" variant="outline">
                      Open Planner
                    </Button>
                  </Link>
                </div>

                {/* Credits + GPA summary */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-t border-border pt-2">
                  {/* Credits */}
                  <span>
                    {gpaData?.plan ? (
                      <>
                        {gpaData.plan.totalCredits} credits planned
                        {gpaData.plan.earnedCredits > 0 ? <>, <span className="text-success">{gpaData.plan.earnedCredits} earned</span></> : null}
                      </>
                    ) : primaryPlan.totalCredits != null ? (
                      <>{primaryPlan.totalCredits} credits</>
                    ) : null}
                    <span className="text-muted-foreground/60"> / 45 required</span>
                  </span>

                  {/* GPA */}
                  {gpaData?.projected?.unweighted != null && (
                    <>
                      <span className="text-border">|</span>
                      <span className="text-primary font-medium">
                        Proj: {gpaData.projected.unweighted.toFixed(2)} / {gpaData.projected.weighted?.toFixed(2) ?? "--"}
                      </span>
                    </>
                  )}
                  {gpaData?.cumulative?.unweighted != null && (
                    <span className="text-success font-medium">
                      Actual: {gpaData.cumulative.unweighted.toFixed(2)} / {gpaData.cumulative.weighted?.toFixed(2) ?? "--"}
                    </span>
                  )}

                </div>
              </div>
            ) : (
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
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                <p className="text-sm font-medium text-foreground">
                  No active plan
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create a plan to start tracking your courses.
                </p>
                <Link href="/planner" className="mt-3">
                  <Button size="sm">Create Plan</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="flex h-full flex-col md:order-6">
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
              <h2 className="text-lg font-semibold text-foreground">
                Quick Actions
              </h2>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="flex flex-col gap-2">
              <Link href="/courses">
                <Button variant="outline" className="w-full justify-start gap-2">
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
                      d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                    />
                  </svg>
                  Browse Courses
                </Button>
              </Link>
              <Link href="/planner">
                <Button variant="outline" className="w-full justify-start gap-2">
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
                      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
                    />
                  </svg>
                  Open Planner
                </Button>
              </Link>
              {(() => {
                const canPrint = currentAccount?.subscriptionTier === "plus" || currentAccount?.subscriptionTier === "elite";
                return canPrint ? (
                  <Link href="/planner/print">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M9.75 8.25h.008v.008H9.75V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                      </svg>
                      Print Plan
                    </Button>
                  </Link>
                ) : (
                  <span title="Upgrade to Plus to print plans">
                    <Button variant="outline" className="w-full justify-start gap-2" disabled>
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M9.75 8.25h.008v.008H9.75V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                      </svg>
                      Print Plan
                    </Button>
                  </span>
                );
              })()}
              <Link href="/progress">
                <Button variant="outline" className="w-full justify-start gap-2">
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
                      d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
                    />
                  </svg>
                  View Progress
                </Button>
              </Link>
              <Link href="/transcript">
                <Button variant="outline" className="w-full justify-start gap-2">
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
                      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                    />
                  </svg>
                  View Transcript
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Attention Required */}
        <Card className="flex h-full flex-col md:order-3">
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
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-foreground">
              Attention Required
            </h2>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          {(reqLoading || planLoading) ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-4 w-40 rounded bg-muted" />
            </div>
          ) : !primaryPlan ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">Create a plan to see requirement status.</p>
              <Link href="/planner" className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary-hover">
                Go to Planner
              </Link>
            </div>
          ) : (() => {
            const gaps = reqData
              ? reqData.requirements.filter((r) => {
                  const covered = (r.earnedCredits ?? 0) + (r.plannedCredits ?? 0);
                  return covered < r.requiredCredits;
                })
              : [];
            const courseLoadGroup = reqData?.groups?.find((g) => g.group === "course_load");
            const semesterIssues = [
              ...(courseLoadGroup?.requirements.filter((r) => r.status === "gap") ?? []).map((r) => {
                const gl = (r.metadata?.gradeLevel as number) ?? 0;
                const sem = (r.metadata?.semester as number) ?? 0;
                return `Gr ${gl} Sem ${sem}: ${r.notes ?? r.name}`;
              }),
              ...(reqData?.gpaWaiverWarnings ?? []).map((msg) =>
                msg.startsWith("Grade") ? msg.replace(/^Grade (\d+) Sem (\d)/, "Gr $1 Sem $2") : msg
              ),
            ];
            const hasNoIssues = gaps.length === 0 && warningCount === 0 && semesterIssues.length === 0;

            return (
              <div className="space-y-4">
                {hasNoIssues && (
                  <div className="flex items-center gap-2 py-2 text-sm text-success">
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    No issues found. All requirements are on track.
                  </div>
                )}

                {!hasNoIssues && (
                  <div className="space-y-2">
                    {gaps.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <span className="font-semibold">Graduation Requirement Gaps</span>
                        <span className="ml-auto rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold">{gaps.length}</span>
                      </div>
                    )}
                    {semesterIssues.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-warning">
                        <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                        </svg>
                        <span className="font-semibold">Semester Requirement Gaps</span>
                        <span className="ml-auto rounded bg-warning/10 px-1.5 py-0.5 text-xs font-semibold">{semesterIssues.length}</span>
                      </div>
                    )}
                    {warningCount > 0 && (
                      <div className="flex items-center gap-2 text-sm text-warning">
                        <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <span className="font-semibold">Prerequisite Violations</span>
                        <span className="ml-auto rounded bg-warning/10 px-1.5 py-0.5 text-xs font-semibold">{warningCount}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <Link href="/planner?validation=open">
                    <Button size="sm" variant="outline">
                      View Report
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
        {/* Achievements & Badges */}
        <Card className="flex h-full flex-col md:order-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-5 w-5 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .982-3.172M2.25 12c0 1.8.68 3.44 1.8 4.681M21.75 12c0 1.8-.68 3.44-1.8 4.681"
              />
            </svg>
            <h2 className="text-lg font-semibold text-foreground">
              Achievements
            </h2>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          {(() => {
            const honorsStatus = (reqData as unknown as { honorsStatus?: { tier: string; weightedGpa: number; totalCredits: number } | null })?.honorsStatus;
            const gradGroup = reqData?.groups?.find((g) => g.group === "graduation");
            const gradReqs = gradGroup?.requirements ?? reqData?.requirements ?? [];
            const gradMet = gradReqs.filter((r) => {
              const covered = (r.earnedCredits ?? 0) + (r.plannedCredits ?? 0);
              return covered >= r.requiredCredits;
            }).length;
            const gradTotal = gradReqs.length;
            const allGradMet = gradTotal > 0 && gradMet === gradTotal;

            const totalCredits = gpaData?.plan?.totalCredits ?? 0;
            const earnedCredits = gpaData?.plan?.earnedCredits ?? 0;
            const weightedGpa = gpaData?.cumulative?.weighted ?? null;

            const badges: Array<{ icon: string; label: string; detail: string; color: string; earned: boolean }> = [];

            // Honor Graduate
            if (honorsStatus) {
              badges.push({
                icon: "star",
                label: honorsStatus.tier,
                detail: `GPA ${honorsStatus.weightedGpa.toFixed(2)} · ${honorsStatus.totalCredits} credits`,
                color: "amber",
                earned: true,
              });
            }

            // All Graduation Requirements Met
            badges.push({
              icon: "check",
              label: "Graduation Ready",
              detail: allGradMet ? `All ${gradTotal} requirements covered` : `${gradMet}/${gradTotal} requirements met`,
              color: "success",
              earned: allGradMet,
            });

            // Credit milestones
            const creditMilestones = [
              { threshold: 45, label: "45 Credits", detail: "Minimum graduation credits reached" },
              { threshold: 30, label: "30 Credits", detail: "Two-thirds of graduation credits" },
              { threshold: 15, label: "15 Credits", detail: "One-third of graduation credits" },
            ];
            for (const m of creditMilestones) {
              if (totalCredits >= m.threshold) {
                badges.push({ icon: "credits", label: m.label, detail: m.detail, color: "primary", earned: true });
                break;
              }
            }

            // GPA milestones
            if (weightedGpa !== null) {
              if (weightedGpa >= 4.0) {
                badges.push({ icon: "gpa", label: "GPA 4.0+", detail: `Weighted GPA ${weightedGpa.toFixed(2)}`, color: "amber", earned: true });
              } else if (weightedGpa >= 3.5) {
                badges.push({ icon: "gpa", label: "GPA 3.5+", detail: `Weighted GPA ${weightedGpa.toFixed(2)}`, color: "primary", earned: true });
              } else if (weightedGpa >= 3.0) {
                badges.push({ icon: "gpa", label: "GPA 3.0+", detail: `Weighted GPA ${weightedGpa.toFixed(2)}`, color: "primary", earned: true });
              }
            }

            // Earned credits milestone
            if (earnedCredits > 0) {
              badges.push({ icon: "earned", label: `${earnedCredits} Earned`, detail: "Credits completed so far", color: "success", earned: true });
            }

            const earnedBadges = badges.filter((b) => b.earned);
            const unearnedBadges = badges.filter((b) => !b.earned);

            const iconMap: Record<string, React.ReactNode> = {
              star: <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>,
              check: <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
              credits: <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" /></svg>,
              gpa: <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>,
              earned: <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>,
            };

            const colorMap: Record<string, string> = {
              amber: "border-amber-400/40 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700",
              success: "border-success/30 bg-success/5 text-success",
              primary: "border-primary/30 bg-primary/5 text-primary",
            };

            if (earnedBadges.length === 0 && unearnedBadges.length === 0) {
              return (
                <p className="py-2 text-sm text-muted-foreground">
                  Complete courses and earn credits to unlock achievements.
                </p>
              );
            }

            return (
              <div className="grid grid-cols-2 gap-2">
                {earnedBadges.map((b) => (
                  <div
                    key={b.label}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${colorMap[b.color] ?? colorMap.primary}`}
                  >
                    {iconMap[b.icon]}
                    <div>
                      <p className="text-sm font-semibold">{b.label}</p>
                      <p className="text-[10px] opacity-70">{b.detail}</p>
                    </div>
                  </div>
                ))}
                {unearnedBadges.map((b) => (
                  <div
                    key={b.label}
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-muted-foreground opacity-50"
                  >
                    {iconMap[b.icon]}
                    <div>
                      <p className="text-sm font-semibold">{b.label}</p>
                      <p className="text-[10px]">{b.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
