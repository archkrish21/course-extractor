"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account-context";
import { useTour } from "@/lib/hooks/use-tour";
import { TOUR_IDS, getProgressTourSteps } from "@/config/tours";
import { apiFetch } from "@/lib/api-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface GpaSnapshot {
  id: string;
  snapshotDate: string;
  trigger: string;
  cumulativeGpa: string | null;
  weightedGpa: string | null;
  creditsEarned: string | null;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface RequirementCourse {
  code: string;
  name: string;
  status: "earned" | "planned";
}

interface RequirementItem {
  id: string;
  name: string;
  status: "met" | "in_progress" | "gap" | "not_started" | "completed";
  earnedCredits: number;
  plannedCredits: number;
  requiredCredits: number;
  notes: string | null;
  evaluationType: string;
  courses: RequirementCourse[];
  metadata?: Record<string, unknown>;
}

interface GroupData {
  group: string;
  label: string;
  isOptIn: boolean;
  enabled: boolean;
  requirements: RequirementItem[];
  totalRequired: number;
  totalEarned: number;
  totalPlanned: number;
}

interface HonorsStatus {
  tier: string;
  weightedGpa: number;
  totalCredits: number;
}

interface RequirementsData {
  totalEarned: number;
  totalPlanned: number;
  totalRequired: number;
  requirements: RequirementItem[];
  groups: GroupData[];
  honorsStatus: HonorsStatus | null;
}

// ─── Status helpers ─────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === "met" || status === "completed") {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success text-xs">&#x2713;</span>;
  }
  if (status === "in_progress") {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary text-xs">&#x25D0;</span>;
  }
  if (status === "gap") {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/15 text-destructive text-xs">&#x2717;</span>;
  }
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs">&#x2022;</span>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "met" || status === "completed") {
    return <Badge className="bg-success/15 text-success text-[10px]">Complete</Badge>;
  }
  if (status === "in_progress") {
    return <Badge className="bg-primary/15 text-primary text-[10px]">In Progress</Badge>;
  }
  if (status === "gap") {
    return <Badge variant="destructive" className="text-[10px]">Gap</Badge>;
  }
  return <Badge variant="default" className="bg-muted text-muted-foreground text-[10px]">Not Started</Badge>;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const { currentAccount } = useAccount();
  const [data, setData] = useState<RequirementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["graduation", "non_course", "course_load", "course_load:count", "course_load:pw"]));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [snapshots, setSnapshots] = useState<GpaSnapshot[]>([]);

  // Guided tour — adapts based on whether data has content
  const hasPlanData = !loading && data !== null && (data.totalEarned > 0 || data.totalPlanned > 0);
  const progressTourSteps = useMemo(() => getProgressTourSteps(hasPlanData), [hasPlanData]);
  useTour({ tourId: TOUR_IDS.progress, steps: progressTourSteps, autoStart: !loading, delay: 800 });

  const matchesFilter = (status: string, evaluationType?: string) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "gap") return status === "gap";
    if (statusFilter === "in_progress") return status === "in_progress";
    if (statusFilter === "met") return status === "met" || status === "completed";
    if (statusFilter === "not_started") return status === "not_started";
    return true;
  };

  // For course_match requirements, derive status from credits
  const deriveCourseMatchStatus = (earned: number, planned: number, required: number) => {
    if (earned >= required) return "met";
    if (earned + planned >= required) return "in_progress";
    return "gap";
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/requirements");
      if (!res.ok) { setError(true); return; }
      const json = await res.json();
      const d = json.data ?? json;
      setData({
        totalEarned: d.totalEarned ?? 0,
        totalPlanned: d.totalPlanned ?? 0,
        totalRequired: d.totalRequired ?? 45,
        requirements: d.requirements ?? [],
        groups: d.groups ?? [],
        honorsStatus: d.honorsStatus ?? null,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, currentAccount]);

  // Fetch GPA snapshots for trend chart
  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const res = await apiFetch("/api/v1/gpa/snapshots");
        if (res.ok) {
          const json = await res.json();
          setSnapshots(json.data ?? json ?? []);
        }
      } catch { /* silent */ }
    }
    fetchSnapshots();
  }, [currentAccount]);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleOptInToggle = async (group: string, currentlyEnabled: boolean) => {
    await apiFetch("/api/v1/requirements/opt-in", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirementGroup: group, enabled: !currentlyEnabled }),
    });
    await fetchData();
    if (!currentlyEnabled) {
      setExpandedGroups((prev) => new Set([...prev, group]));
    }
  };

  const handleStatusToggle = async (requirementId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "not_started" : "completed";
    await apiFetch("/api/v1/requirements/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirementId, status: newStatus }),
    });
    await fetchData();
  };

  // Overall summary across all groups — with earned/planned/gap breakdown
  const groupSummaries = (data?.groups ?? [])
    .filter((g) => !g.isOptIn || g.enabled)
    .map((g) => {
      let earned = 0;
      let planned = 0;
      let gaps = 0;
      for (const r of g.requirements) {
        if (r.evaluationType === "course_match") {
          const e = r.earnedCredits ?? 0;
          const p = r.plannedCredits ?? 0;
          if (e >= r.requiredCredits) earned++;
          else if (e + p >= r.requiredCredits) planned++;
          else gaps++;
        } else {
          if (r.status === "met" || r.status === "completed") earned++;
          else if (r.status === "in_progress") planned++;
          else gaps++;
        }
      }
      return { group: g.group, label: g.label, total: g.requirements.length, earned, planned, gaps };
    });
  const totalReqsAll = groupSummaries.reduce((s, g) => s + g.total, 0);
  const totalEarnedAll = groupSummaries.reduce((s, g) => s + g.earned, 0);
  const totalPlannedAll = groupSummaries.reduce((s, g) => s + g.planned, 0);
  const totalGapsAll = groupSummaries.reduce((s, g) => s + g.gaps, 0);
  const overallEarnedPct = totalReqsAll > 0 ? Math.round((totalEarnedAll / totalReqsAll) * 100) : 0;
  const overallPlannedPct = totalReqsAll > 0 ? Math.min(100 - overallEarnedPct, Math.round((totalPlannedAll / totalReqsAll) * 100)) : 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Academic Progress</h1>
        <p className="mb-6 text-sm text-muted-foreground">Track your graduation requirements, credits, and GPA over time.</p>
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-48 rounded-xl bg-muted" />
          <div className="h-48 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  const hasNoPlan = data && data.totalEarned === 0 && data.totalPlanned === 0;

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Academic Progress</h1>
        <p className="mb-6 text-sm text-muted-foreground">Track your graduation requirements, credits, and GPA over time.</p>
        <Card>
          <CardContent>
            <div className="py-8 text-center">
              <p className="text-muted-foreground">Unable to load requirements.</p>
              <Link href="/planner">
                <Button size="sm" variant="outline" className="mt-3">Open Planner</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasNoPlan) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Academic Progress</h1>
        <p className="mb-6 text-sm text-muted-foreground">Track your graduation requirements, credits, and GPA over time.</p>
        <Card>
          <CardContent>
            <div className="py-12 text-center">
              <svg aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
              </svg>
              <p className="text-base font-semibold text-foreground">No active plan yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a plan to see your progress.</p>
              <Link href="/planner">
                <Button size="sm" className="mt-4">Go to Planner</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Academic Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track your graduation requirements, credits, and GPA over time.</p>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const canPrint = currentAccount?.subscriptionTier === "plus" || currentAccount?.subscriptionTier === "elite";
            return (
              <span className="relative group" title={canPrint ? "Print progress report" : "Upgrade to Plus to print"}>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => canPrint && window.print()} disabled={!canPrint} aria-label={canPrint ? "Print progress report" : "Upgrade to Plus to print"}>
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M9.75 8.25h.008v.008H9.75V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  Print
                </Button>
                {!canPrint && (
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-3 py-1.5 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    Upgrade to Plus to print
                  </span>
                )}
              </span>
            );
          })()}
          <Link href="/planner">
            <Button size="sm" variant="outline" className="gap-1.5">
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
              Edit Plan
            </Button>
          </Link>
        </div>
      </div>

      {/* Two-column layout: requirements (2/3) | summary sidebar (1/3) */}
      <div className="flex flex-col gap-6 lg:flex-row">

        {/* Left column — filter + requirement groups */}
        <div className="min-w-0 lg:w-2/3" data-tour="progress-requirements">

          {/* Status filter */}
      {(() => {
        const filters = [
          { key: "all", label: "All" },
          { key: "met", label: "Met" },
          { key: "in_progress", label: "In Progress" },
          { key: "gap", label: "Gaps" },
          { key: "not_started", label: "Not Started" },
        ];
        return (
          <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" data-tour="progress-filter">
            <div className="flex items-center gap-1.5 shrink-0">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    statusFilter === f.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                const allKeys = new Set<string>();
                for (const g of data?.groups ?? []) {
                  allKeys.add(g.group);
                  if (g.group === "course_load") { allKeys.add("course_load:count"); allKeys.add("course_load:pw"); }
                }
                setExpandedGroups(allKeys);
              }}
              className="shrink-0 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() => setExpandedGroups(new Set())}
              className="shrink-0 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Collapse All
            </button>
          </div>
        );
      })()}

      {/* Requirement groups */}
      <div className="space-y-6">
        {data.groups.map((group) => (
          <div key={group.group}>
            {/* Group header */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => toggleGroup(group.group)}
                className="flex items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
                aria-expanded={expandedGroups.has(group.group)}
              >
                <svg
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${expandedGroups.has(group.group) ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h2>
                {group.isOptIn && (
                  <Badge className={group.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}>
                    {group.enabled ? "Tracking" : "Not Tracking"}
                  </Badge>
                )}
              </button>
              <div className="flex items-center gap-2">
                {group.isOptIn && (
                  <span className="relative group/optin">
                    <Button
                      size="sm"
                      variant={group.enabled ? "outline" : "default"}
                      onClick={() => handleOptInToggle(group.group, group.enabled)}
                    >
                      {group.enabled ? "Disable Tracking" : "Enable Tracking"}
                    </Button>
                    <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-3 py-1.5 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover/optin:opacity-100">
                      Opt-in: track this optional requirement group toward your goals
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Group content */}
            {expandedGroups.has(group.group) && (
              <div className="space-y-3">
                {(!group.isOptIn || group.enabled) ? (
                  (() => {
                    // Sub-group course_load requirements by evaluation type
                    if (group.group === "course_load") {
                      const courseLoadReqs = group.requirements.filter((r) => r.evaluationType === "course_load_check" && matchesFilter(r.status, r.evaluationType));
                      const pwDanceReqs = group.requirements.filter((r) => r.evaluationType === "pw_dance_check" && matchesFilter(r.status, r.evaluationType));

                      const renderCards = (reqs: typeof group.requirements) => reqs.map((req) => {
                        const meta = req.metadata ?? {};
                        const count = (meta.courseCount as number) ?? 0;
                        const min = (meta.min as number) ?? 5;
                        const isOk = req.status === "met";

                        return (
                          <Card key={req.id} className={isOk ? "" : "border-warning/30"}>
                            <CardContent>
                              <div className="flex items-center gap-3">
                                <StatusIcon status={req.status} />
                                <div className="flex-1">
                                  <h3 className="font-semibold text-foreground">{req.name}</h3>
                                  <p className={`mt-0.5 text-xs ${isOk ? "text-muted-foreground" : "text-warning"}`}>
                                    {req.notes}
                                  </p>
                                </div>
                                {isOk ? (
                                  <Badge className="bg-success/15 text-success text-[10px]">OK</Badge>
                                ) : (
                                  <Badge className="bg-warning/15 text-warning text-[10px]">
                                    {req.evaluationType === "pw_dance_check" ? "Missing" : count < min ? "Underload" : "Overload"}
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      });

                      return (
                        <>
                          {courseLoadReqs.length > 0 && (
                            <div>
                              <button
                                type="button"
                                onClick={() => toggleGroup("course_load:count")}
                                className="mb-2 flex w-full items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
                                aria-expanded={expandedGroups.has("course_load:count")}
                              >
                                <svg
                                  aria-hidden="true"
                                  className={`h-3.5 w-3.5 transition-transform ${expandedGroups.has("course_load:count") ? "rotate-180" : ""}`}
                                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                                Course Count Per Semester ({courseLoadReqs.filter((r) => r.status === "gap").length} issue{courseLoadReqs.filter((r) => r.status === "gap").length !== 1 ? "s" : ""})
                              </button>
                              {expandedGroups.has("course_load:count") && renderCards(courseLoadReqs)}
                            </div>
                          )}
                          {pwDanceReqs.length > 0 && (
                            <div>
                              <button
                                type="button"
                                onClick={() => toggleGroup("course_load:pw")}
                                className="mb-2 flex w-full items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
                                aria-expanded={expandedGroups.has("course_load:pw")}
                              >
                                <svg
                                  aria-hidden="true"
                                  className={`h-3.5 w-3.5 transition-transform ${expandedGroups.has("course_load:pw") ? "rotate-180" : ""}`}
                                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                                Physical Welfare / Dance / Driver Ed ({pwDanceReqs.filter((r) => r.status === "gap").length} issue{pwDanceReqs.filter((r) => r.status === "gap").length !== 1 ? "s" : ""})
                              </button>
                              {expandedGroups.has("course_load:pw") && renderCards(pwDanceReqs)}
                            </div>
                          )}
                        </>
                      );
                    }

                    // Default: render all requirements flat
                    return group.requirements.filter((req) => {
                      if (req.evaluationType === "course_match") {
                        const s = deriveCourseMatchStatus(req.earnedCredits ?? 0, req.plannedCredits ?? 0, req.requiredCredits ?? 0);
                        return matchesFilter(s, req.evaluationType);
                      }
                      return matchesFilter(req.status, req.evaluationType);
                    }).map((req) => {
                    // Course-match requirements
                    if (req.evaluationType === "course_match") {
                      const earned = req.earnedCredits ?? 0;
                      const planned = req.plannedCredits ?? 0;
                      const required = req.requiredCredits ?? 0;
                      const covered = earned + planned;
                      const localStatus = earned >= required ? "met" : covered >= required ? "in_progress" : "gap";
                      const ePct = required > 0 ? Math.min(100, Math.round((earned / required) * 100)) : 0;
                      const pPct = required > 0 ? Math.min(100 - ePct, Math.round((planned / required) * 100)) : 0;

                      return (
                        <Card key={req.id}>
                          <CardContent>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <StatusIcon status={localStatus} />
                                  <h3 className="font-semibold text-foreground">{req.name}</h3>
                                  <StatusBadge status={localStatus} />
                                </div>
                                {req.notes && <p className="mt-1 text-xs text-muted-foreground">{req.notes}</p>}
                              </div>
                              <div className="text-right text-sm">
                                <span className="font-semibold text-foreground">{covered}</span>
                                <span className="text-muted-foreground"> / {required} credits</span>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                                {ePct > 0 && <div className="h-full bg-success" style={{ width: `${ePct}%` }} />}
                                {pPct > 0 && <div className="h-full bg-primary/50" style={{ width: `${pPct}%` }} />}
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  {earned > 0 && (
                                    <span className="flex items-center gap-1">
                                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                                      <span className="text-success">{earned} earned</span>
                                    </span>
                                  )}
                                  {planned > 0 && (
                                    <span className="flex items-center gap-1">
                                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/50" />
                                      <span className="text-primary">{planned} planned</span>
                                    </span>
                                  )}
                                </div>
                                {localStatus === "gap" && (
                                  <span className="text-destructive">{required - covered} needed</span>
                                )}
                              </div>
                            </div>
                            {req.courses.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {req.courses.map((c) => (
                                  <span
                                    key={c.code}
                                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
                                      c.status === "earned" ? "border-success/30 bg-success/10 text-success" : "border-primary/30 bg-primary/10 text-primary"
                                    }`}
                                  >
                                    <span className={`h-1.5 w-1.5 rounded-full ${c.status === "earned" ? "bg-success" : "bg-primary"}`} />
                                    {c.code}
                                  </span>
                                ))}
                              </div>
                            )}
                            {localStatus === "gap" && (
                              <p className="mt-2 text-xs text-destructive">
                                {required - covered} more credit{required - covered !== 1 ? "s" : ""} needed
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    }

                    // Manual checkbox requirements
                    if (req.evaluationType === "manual_checkbox") {
                      const isComplete = req.status === "completed";
                      return (
                        <Card key={req.id} className={isComplete ? "border-success/30" : ""}>
                          <CardContent>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleStatusToggle(req.id, req.status)}
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                                  isComplete ? "border-success bg-success text-white" : "border-muted-foreground/40 hover:border-primary"
                                }`}
                                aria-label={`Mark ${req.name} as ${isComplete ? "incomplete" : "complete"}`}
                              >
                                {isComplete && <span className="text-xs">&#x2713;</span>}
                              </button>
                              <div className="flex-1">
                                <h3 className={`font-semibold ${isComplete ? "text-success line-through" : "text-foreground"}`}>{req.name}</h3>
                                {req.notes && <p className="mt-0.5 text-xs text-muted-foreground">{req.notes}</p>}
                              </div>
                              <StatusBadge status={req.status} />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    // Auto-from-course requirements
                    if (req.evaluationType === "auto_from_course") {
                      return (
                        <Card key={req.id} className={req.status === "completed" ? "border-success/30" : ""}>
                          <CardContent>
                            <div className="flex items-center gap-3">
                              <StatusIcon status={req.status} />
                              <div className="flex-1">
                                <h3 className="font-semibold text-foreground">{req.name}</h3>
                                {req.notes && <p className="mt-0.5 text-xs text-muted-foreground">{req.notes}</p>}
                              </div>
                              <StatusBadge status={req.status} />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    // Course load check or PW/Dance/DriverEd check
                    if (req.evaluationType === "course_load_check" || req.evaluationType === "pw_dance_check") {
                      const meta = req.metadata ?? {};
                      const count = (meta.courseCount as number) ?? 0;
                      const min = (meta.min as number) ?? 5;
                      const max = (meta.max as number) ?? 7;
                      const isOk = req.status === "met";

                      return (
                        <Card key={req.id} className={isOk ? "" : "border-warning/30"}>
                          <CardContent>
                            <div className="flex items-center gap-3">
                              <StatusIcon status={req.status} />
                              <div className="flex-1">
                                <h3 className="font-semibold text-foreground">{req.name}</h3>
                                <p className={`mt-0.5 text-xs ${isOk ? "text-muted-foreground" : "text-warning"}`}>
                                  {req.notes}
                                </p>
                              </div>
                              {isOk ? (
                                <Badge className="bg-success/15 text-success text-[10px]">OK</Badge>
                              ) : (
                                <Badge className="bg-warning/15 text-warning text-[10px]">
                                  {req.evaluationType === "pw_dance_check" ? "Missing" : count < min ? "Underload" : "Overload"}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    // Fallback
                    return (
                      <Card key={req.id}>
                        <CardContent>
                          <div className="flex items-center gap-3">
                            <StatusIcon status={req.status} />
                            <h3 className="font-semibold text-foreground">{req.name}</h3>
                            <StatusBadge status={req.status} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  });
                  })()
                ) : (
                  <Card>
                    <CardContent>
                      <p className="py-2 text-sm text-muted-foreground">
                        Enable tracking to see {group.label.toLowerCase()} progress.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

        </div>{/* end left column */}

        {/* Right column — summary sidebar (moves below main on mobile) */}
        <div className="lg:w-1/3">
          <div className="sticky top-4 space-y-4">
            {/* Honors achievement badge */}
            {data.honorsStatus && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
                <svg aria-hidden="true" className="h-7 w-7 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
                <div>
                  <p className="font-bold text-amber-700">{data.honorsStatus.tier}</p>
                  <p className="text-xs text-amber-600/80">
                    GPA {data.honorsStatus.weightedGpa.toFixed(2)} · {data.honorsStatus.totalCredits} credits
                  </p>
                </div>
              </div>
            )}

            {/* GPA Trend Chart */}
            {snapshots.length >= 2 && (() => {
              const chartData = [...snapshots]
                .reverse()
                .map((s) => ({
                  date: new Date(s.snapshotDate).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
                  unweighted: s.cumulativeGpa ? parseFloat(s.cumulativeGpa) : null,
                  weighted: s.weightedGpa ? parseFloat(s.weightedGpa) : null,
                }));

              return (
                <Card>
                  <CardContent>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">GPA Trend</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          className="text-muted-foreground"
                          label={{ value: "Date", position: "insideBottom", offset: -2, fontSize: 10, fill: "var(--color-muted-foreground)" }}
                        />
                        <YAxis
                          domain={[0, 5]}
                          tick={{ fontSize: 10 }}
                          className="text-muted-foreground"
                          label={{ value: "GPA", angle: -90, position: "insideLeft", offset: 15, fontSize: 10, fill: "var(--color-muted-foreground)" }}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card)" }}
                          formatter={(value: unknown, name: unknown) => [Number(value)?.toFixed(3), String(name) === "unweighted" ? "Unweighted" : "Weighted"]}
                        />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} formatter={(value) => value === "unweighted" ? "Unweighted" : "Weighted"} />
                        <Line type="monotone" dataKey="unweighted" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} connectNulls name="unweighted" />
                        <Line type="monotone" dataKey="weighted" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 3 }} connectNulls name="weighted" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Overall summary card */}
            <Card>
              <CardContent>
                {/* Overall stats */}
                <div className="flex items-center justify-between py-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overall</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-success font-semibold">{totalEarnedAll} earned</span>
                    <span className="text-primary font-semibold">{totalPlannedAll} planned</span>
                    {totalGapsAll > 0 && <span className="text-destructive font-semibold">{totalGapsAll} gap{totalGapsAll !== 1 ? "s" : ""}</span>}
                  </div>
                </div>

                {/* Overall segmented progress bar */}
                <div className="mt-1">
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    {overallEarnedPct > 0 && (
                      <div className="h-full bg-success transition-all duration-500" style={{ width: `${overallEarnedPct}%` }} />
                    )}
                    {overallPlannedPct > 0 && (
                      <div className="h-full bg-primary/50 transition-all duration-500" style={{ width: `${overallPlannedPct}%` }} />
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />Earned</span>
                      <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/50" />Planned</span>
                    </div>
                    <span>{totalEarnedAll + totalPlannedAll}/{totalReqsAll}</span>
                  </div>
                </div>

                {/* Per-category breakdown */}
                <div className="mt-6 border-t border-border pt-4 space-y-3">
                  {groupSummaries.map((gs) => {
                    const ePct = gs.total > 0 ? Math.round((gs.earned / gs.total) * 100) : 0;
                    const pPct = gs.total > 0 ? Math.min(100 - ePct, Math.round((gs.planned / gs.total) * 100)) : 0;
                    return (
                      <div key={gs.group}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{gs.label}</p>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {gs.earned > 0 && <span className="text-success font-semibold">{gs.earned}</span>}
                            {gs.planned > 0 && <span className="text-primary font-semibold">{gs.planned}</span>}
                            {gs.gaps > 0 && <span className="text-destructive font-semibold">{gs.gaps}</span>}
                            <span className="text-muted-foreground">/ {gs.total}</span>
                          </div>
                        </div>
                        <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          {ePct > 0 && <div className="h-full bg-success" style={{ width: `${ePct}%` }} />}
                          {pPct > 0 && <div className="h-full bg-primary/50" style={{ width: `${pPct}%` }} />}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>
                            {gs.earned > 0 && <><span className="text-success">{gs.earned} earned</span> </>}
                            {gs.planned > 0 && <><span className="text-primary">{gs.planned} planned</span> </>}
                          </span>
                          {gs.gaps > 0 ? (
                            <span className="text-destructive">{gs.gaps} gap{gs.gaps !== 1 ? "s" : ""}</span>
                          ) : gs.earned === gs.total ? (
                            <span className="text-success">Complete</span>
                          ) : (
                            <span className="text-primary">On track</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>{/* end right column */}

      </div>{/* end two-column layout */}
    </div>
  );
}
