"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";
import { ShareModal } from "@/components/plans/share-modal";
import { useToast } from "@/components/ui/toast";

interface Plan {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  isPrimary: boolean;
  courseCount: number;
  createdAt: string;
  createdBy: string | null;
  creatorEmail: string | null;
  creatorRole: string | null;
  permission: string | null;
  isHidden: boolean | null;
  sharedCount: number;
  lockedGradeLevels: number[] | null;
}

const PERMISSION_LABELS: Record<string, string> = {
  owner: "Owner",
  delete: "Full access",
  edit: "Can edit",
  view: "View only",
};

const PERMISSION_COLORS: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  delete: "bg-warning/10 text-warning",
  edit: "bg-success/10 text-success",
  view: "bg-muted text-muted-foreground",
};

export default function PlansPage() {
  const { currentAccount } = useAccount();
  const { showToast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareModal, setShareModal] = useState<{ planId: string; planName: string; createdBy: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"my" | "shared">("my");

  const fetchPlans = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/plans?include_hidden=true");
      if (res.ok) {
        const json = await res.json();
        setPlans(json.data ?? json ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans, currentAccount]);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const myPlans = plans.filter(
    (p) => p.permission === "owner" || !p.permission
  );
  const sharedPlans = plans.filter(
    (p) => p.permission && p.permission !== "owner"
  );

  const handleToggleVisibility = async (planId: string, currentlyHidden: boolean) => {
    try {
      const res = await apiFetch(`/api/v1/plans/${planId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_hidden: !currentlyHidden }),
      });
      if (res.ok) {
        setPlans((prev) =>
          prev.map((p) =>
            p.id === planId ? { ...p, isHidden: !currentlyHidden } : p
          )
        );
        showToast(currentlyHidden ? "Plan visible in planner" : "Plan hidden from planner");
      }
    } catch { /* silent */ }
  };

  const executeDeletePlan = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/v1/plans/${deleteConfirm.id}`, { method: "DELETE" });
      if (res.ok) {
        setPlans((prev) => prev.filter((p) => p.id !== deleteConfirm.id));
        showToast(`"${deleteConfirm.name}" deleted`);
        setDeleteConfirm(null);
      } else {
        const json = await res.json().catch(() => null);
        showToast(json?.error?.message ?? "Failed to delete plan.");
      }
    } catch { /* silent */ }
    finally { setDeleting(false); }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">My Plans</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const renderPlanCard = (plan: Plan) => {
    const isOwner = plan.permission === "owner" || !plan.permission;
    const perm = plan.permission ?? "owner";
    const isHidden = plan.isHidden ?? false;

    return (
      <Card key={plan.id} className={`transition-opacity ${isHidden ? "opacity-60" : ""}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            {/* Plan info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/planner?planId=${plan.id}`}
                  className="text-base font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {plan.name}
                </Link>
                {plan.isPrimary && (
                  <Badge className="bg-primary/10 text-primary">Primary</Badge>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Badge
                  variant={
                    plan.status === "active"
                      ? "success"
                      : plan.status === "archived"
                        ? "default"
                        : "warning"
                  }
                >
                  {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                </Badge>
                <Badge className={PERMISSION_COLORS[perm]}>
                  {PERMISSION_LABELS[perm]}
                </Badge>
                {isHidden && (
                  <Badge variant="default">Hidden</Badge>
                )}
              </div>

              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{plan.courseCount} course{plan.courseCount !== 1 ? "s" : ""}</span>
                <span className="text-border">|</span>
                <span>{formatDate(plan.createdAt)}</span>
                {!isOwner && plan.creatorEmail && (
                  <>
                    <span className="text-border">|</span>
                    <span>by {plan.creatorEmail}</span>
                  </>
                )}
                {isOwner && plan.sharedCount > 0 && (
                  <>
                    <span className="text-border">|</span>
                    <span>Shared with {plan.sharedCount}</span>
                  </>
                )}
                {plan.lockedGradeLevels && plan.lockedGradeLevels.length > 0 && (
                  <>
                    <span className="text-border">|</span>
                    <span className="flex items-center gap-0.5">
                      <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                      Gr {plan.lockedGradeLevels.join(", ")} locked
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Edit / Open in planner */}
              <Link href={`/planner?planId=${plan.id}`}>
                <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
                  <svg aria-hidden="true" className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                  Edit
                </Button>
              </Link>

              {/* Share button (owner only) */}
              {isOwner && currentAccount && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => setShareModal({ planId: plan.id, planName: plan.name, createdBy: plan.createdBy ?? "" })}
                  title="Share plan"
                >
                  <svg aria-hidden="true" className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                  </svg>
                  Share
                </Button>
              )}

              {/* Show/hide toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground"
                onClick={() => handleToggleVisibility(plan.id, isHidden)}
                title={isHidden ? "Show in planner" : "Hide from planner"}
              >
                {isHidden ? (
                  <svg aria-hidden="true" className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
                {isHidden ? "Show" : "Hide"}
              </Button>

              {/* Delete (owner or delete permission) */}
              {(isOwner || perm === "delete") && (
                <span title={plan.isPrimary ? "Cannot delete the primary plan. Set another plan as primary first." : "Delete plan"}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive-light hover:text-destructive"
                    onClick={() => !plan.isPrimary && setDeleteConfirm({ id: plan.id, name: plan.name })}
                    disabled={plan.isPrimary}
                  >
                    <svg aria-hidden="true" className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                    Delete
                  </Button>
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/planner"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Back to planner"
          >
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Plans</h1>
        </div>
        <Link href="/planner?newPlan=true">
          <Button size="sm">
            <svg aria-hidden="true" className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Plan
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("my")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "my"
              ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:rounded-full"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          My Plans ({myPlans.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("shared")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "shared"
              ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:rounded-full"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Shared with Me ({sharedPlans.length})
        </button>
      </div>

      {/* Plan list */}
      <div className="space-y-3">
        {activeTab === "my" && (
          myPlans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <svg aria-hidden="true" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <p className="mt-4 text-base font-semibold text-foreground">No plans yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first course plan to start organizing your schedule.
                </p>
                <Link href="/planner?newPlan=true" className="mt-4">
                  <Button size="sm">
                    <svg aria-hidden="true" className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Create First Plan
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            myPlans.map(renderPlanCard)
          )
        )}

        {activeTab === "shared" && (
          sharedPlans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <svg aria-hidden="true" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                  </svg>
                </div>
                <p className="mt-4 text-base font-semibold text-foreground">No shared plans</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No one has shared plans with you yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            sharedPlans.map(renderPlanCard)
          )
        )}
      </div>

      {/* Share modal */}
      {/* Delete plan confirmation */}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setDeleteConfirm(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-xl bg-card shadow-xl"
              role="alertdialog"
              aria-modal="true"
              aria-label="Delete plan confirmation"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive-light">
                    <svg aria-hidden="true" className="h-5 w-5 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      Delete &ldquo;{deleteConfirm.name}&rdquo;?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This will permanently delete the plan and all its courses. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={executeDeletePlan}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete Plan"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {shareModal && currentAccount && (
        <ShareModal
          planId={shareModal.planId}
          planName={shareModal.planName}
          accountId={currentAccount.id}
          currentUserId={shareModal.createdBy}
          isOpen={true}
          onClose={() => setShareModal(null)}
          onUpdated={fetchPlans}
        />
      )}
    </div>
  );
}
