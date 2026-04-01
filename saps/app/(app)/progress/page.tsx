"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";

interface RequirementCourse {
  code: string;
  name: string;
  status: "earned" | "planned";
}

interface RequirementItem {
  id: string;
  name: string;
  status: "met" | "in_progress" | "gap";
  earnedCredits: number;
  plannedCredits: number;
  requiredCredits: number;
  notes: string | null;
  courses: RequirementCourse[];
}

interface RequirementsData {
  totalEarned: number;
  totalPlanned: number;
  totalRequired: number;
  requirements: RequirementItem[];
}

export default function ProgressPage() {
  const { currentAccount } = useAccount();
  const [data, setData] = useState<RequirementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchRequirements() {
      try {
        const res = await apiFetch("/api/v1/requirements");
        if (!res.ok) {
          setError(true);
          return;
        }
        const json = await res.json();
        const d = json.data ?? json;
        setData({
          totalEarned: d.totalEarned ?? 0,
          totalPlanned: d.totalPlanned ?? 0,
          totalRequired: d.totalRequired ?? 45,
          requirements: d.requirements ?? [],
        });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchRequirements();
  }, [currentAccount]);

  const totalCovered = (data?.totalEarned ?? 0) + (data?.totalPlanned ?? 0);
  const earnedPct = data && data.totalRequired > 0
    ? Math.min(100, Math.round((data.totalEarned / data.totalRequired) * 100))
    : 0;
  const plannedPct = data && data.totalRequired > 0
    ? Math.min(100 - earnedPct, Math.round((data.totalPlanned / data.totalRequired) * 100))
    : 0;

  const metCount = data?.requirements.filter((r) => {
    const covered = (r.earnedCredits ?? 0) + (r.plannedCredits ?? 0);
    return covered >= r.requiredCredits;
  }).length ?? 0;
  const totalReqs = data?.requirements.length ?? 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Graduation Progress</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-48 rounded-xl bg-muted" />
          <div className="h-48 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Graduation Progress</h1>
        <Card>
          <CardContent>
            <div className="py-8 text-center">
              <p className="text-muted-foreground">Unable to load graduation requirements.</p>
              <Link href="/planner">
                <Button size="sm" variant="outline" className="mt-3">
                  Open Planner
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Graduation Progress</h1>
        <Link href="/planner">
          <Button size="sm" variant="outline" className="gap-1.5">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            Edit Plan
          </Button>
        </Link>
      </div>

      {/* Overall summary card */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Total Credits</p>
              <p className="text-2xl font-bold text-foreground">
                {totalCovered}
                <span className="text-base font-normal text-muted-foreground"> / {data.totalRequired}</span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Earned</p>
              <p className="text-2xl font-bold text-success">{data.totalEarned}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Planned</p>
              <p className="text-2xl font-bold text-primary">{data.totalPlanned}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Requirements Met</p>
              <p className="text-2xl font-bold text-foreground">
                {metCount}
                <span className="text-base font-normal text-muted-foreground"> / {totalReqs}</span>
              </p>
            </div>
            {totalReqs - metCount > 0 && (
              <div>
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  Gaps
                </p>
                <p className="text-2xl font-bold text-destructive">{totalReqs - metCount}</p>
              </div>
            )}
          </div>

          {/* Overall progress bar */}
          <div className="mt-3">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
              {earnedPct > 0 && (
                <div
                  className="h-full bg-success transition-all duration-500"
                  style={{ width: `${earnedPct}%` }}
                />
              )}
              {plannedPct > 0 && (
                <div
                  className="h-full bg-primary/50 transition-all duration-500"
                  style={{ width: `${plannedPct}%` }}
                />
              )}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-success" /> Earned
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-primary/50" /> Planned
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" /> Remaining
                </span>
              </div>
              <span>{earnedPct + plannedPct}% covered</span>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Per-requirement cards */}
      <div className="space-y-4">
        {data.requirements.map((req) => {
          const earned = req.earnedCredits ?? 0;
          const planned = req.plannedCredits ?? 0;
          const required = req.requiredCredits ?? 0;
          const covered = earned + planned;
          const localStatus = earned >= required ? "met" : covered >= required ? "in_progress" : "gap";
          const ePct = required > 0 ? Math.min(100, Math.round((earned / required) * 100)) : 0;
          const pPct = required > 0 ? Math.min(100 - ePct, Math.round((planned / required) * 100)) : 0;

          return (
            <Card key={req.id ?? req.name}>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {localStatus === "met" && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success text-xs">&#x2713;</span>
                      )}
                      {localStatus === "in_progress" && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary text-xs">&#x25D0;</span>
                      )}
                      {localStatus === "gap" && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/15 text-destructive text-xs">&#x2717;</span>
                      )}
                      <h3 className="font-semibold text-foreground">{req.name}</h3>
                      <Badge
                        variant={localStatus === "met" ? "default" : localStatus === "in_progress" ? "default" : "destructive"}
                        className={localStatus === "met" ? "bg-success/15 text-success" : localStatus === "in_progress" ? "bg-primary/15 text-primary" : ""}
                      >
                        {localStatus === "met" ? "Complete" : localStatus === "in_progress" ? "In Progress" : "Gap"}
                      </Badge>
                    </div>
                    {req.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{req.notes}</p>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <span className="font-semibold text-foreground">{covered}</span>
                    <span className="text-muted-foreground"> / {required} credits</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    {ePct > 0 && (
                      <div className="h-full bg-success" style={{ width: `${ePct}%` }} />
                    )}
                    {pPct > 0 && (
                      <div className="h-full bg-primary/50" style={{ width: `${pPct}%` }} />
                    )}
                  </div>
                </div>

                {/* Course list */}
                {req.courses.length > 0 && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {req.courses.map((c) => (
                        <span
                          key={c.code}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
                            c.status === "earned"
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-primary/30 bg-primary/10 text-primary"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${c.status === "earned" ? "bg-success" : "bg-primary"}`} />
                          {c.code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gap message */}
                {localStatus === "gap" && (
                  <p className="mt-2 text-xs text-destructive">
                    {required - covered} more credit{required - covered !== 1 ? "s" : ""} needed
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
