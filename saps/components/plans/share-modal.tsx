"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

interface Member {
  user_id: string;
  email: string;
  role: string;
  can_edit: boolean;
}

interface Share {
  user_id: string;
  email: string;
  permission: string;
}

interface ShareModalProps {
  planId: string;
  planName: string;
  accountId: string;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

type PermissionOption = "none" | "view" | "edit" | "delete";

export function ShareModal({
  planId,
  planName,
  accountId,
  currentUserId,
  isOpen,
  onClose,
  onUpdated,
}: ShareModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    async function fetchData() {
      setLoading(true);
      try {
        const [membersRes, sharesRes] = await Promise.all([
          apiFetch(`/api/v1/accounts/${accountId}/members`),
          apiFetch(`/api/v1/plans/${planId}/shares`),
        ]);
        if (membersRes.ok) {
          const mData = await membersRes.json();
          setMembers(mData.data ?? mData ?? []);
        }
        if (sharesRes.ok) {
          const sData = await sharesRes.json();
          setShares(sData.data ?? sData ?? []);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    fetchData();
  }, [isOpen, planId, accountId]);

  const getPermission = (userId: string): PermissionOption => {
    const share = shares.find((s) => s.user_id === userId);
    if (!share) return "none";
    return share.permission as PermissionOption;
  };

  const handleChange = async (userId: string, newPerm: PermissionOption) => {
    setSaving(userId);
    try {
      const currentPerm = getPermission(userId);

      if (newPerm === "none" && currentPerm !== "none") {
        // Revoke
        await apiFetch(`/api/v1/plans/${planId}/shares/${userId}`, {
          method: "DELETE",
        });
        setShares((prev) => prev.filter((s) => s.user_id !== userId));
      } else if (currentPerm === "none" && newPerm !== "none") {
        // Create
        const res = await apiFetch(`/api/v1/plans/${planId}/shares`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, permission: newPerm }),
        });
        if (res.ok) {
          const member = members.find((m) => m.user_id === userId);
          setShares((prev) => [
            ...prev,
            { user_id: userId, email: member?.email ?? "", permission: newPerm },
          ]);
        }
      } else {
        // Update
        await apiFetch(`/api/v1/plans/${planId}/shares/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permission: newPerm }),
        });
        setShares((prev) =>
          prev.map((s) =>
            s.user_id === userId ? { ...s, permission: newPerm } : s
          )
        );
      }
      onUpdated();
    } catch { /* silent */ }
    finally { setSaving(null); }
  };

  if (!isOpen) return null;

  const otherMembers = members.filter((m) => m.user_id !== currentUserId);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-xl bg-card shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-label={`Share ${planName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-border px-6 py-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Share &ldquo;{planName}&rdquo;
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose who can access this plan and their permission level.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Close share dialog"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-4">
            {loading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : otherMembers.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No other family members to share with. Invite members from Settings.
              </div>
            ) : (
              <div className="space-y-3">
                {otherMembers.map((member) => {
                  const perm = getPermission(member.user_id);
                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {member.email}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {member.role}
                        </p>
                      </div>
                      <select
                        value={perm}
                        onChange={(e) =>
                          handleChange(
                            member.user_id,
                            e.target.value as PermissionOption
                          )
                        }
                        disabled={saving === member.user_id}
                        className="h-8 rounded border border-border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <option value="none">No access</option>
                        <option value="view">View only</option>
                        <option value="edit">Can edit</option>
                        <option value="delete">Full access</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end border-t border-border px-6 py-3">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
