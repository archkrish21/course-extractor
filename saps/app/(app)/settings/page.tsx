"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { US_STATES } from "@/config/us-states";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { FREE_LAUNCH_MODE, LAUNCH_TIER } from "@/config/subscription-plans";

interface AccountMember {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  canEdit: boolean;
  joinedAt: string;
  canRemove: boolean;
}

interface PendingInvite {
  inviteId: string;
  email: string | null;
  role: string;
  expiresAt: string;
  canRevoke: boolean;
}

export default function SettingsPage() {
  const { currentAccount, refetchAccounts, userEmail, userRole, userFirstName, userLastName, refetchUser, onboardingCompleted } = useAccount();
  const { showToast } = useToast();

  // State
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingUserName, setEditingUserName] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [savingUserName, setSavingUserName] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("parent");
  const [generating, setGenerating] = useState(false);
  const [consentInfo, setConsentInfo] = useState<Array<{ type: string; version: string; accepted_at: string }>>([]);
  const [billingCycle, setBillingCycle] = useState<string | null>(null);
  const [nextPayment, setNextPayment] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [exportOnDelete, setExportOnDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unlinkConfirm, setUnlinkConfirm] = useState<{ studentName: string } | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{ userId: string; name: string; role: string } | null>(null);
  const [memberLimit, setMemberLimit] = useState(3);
  const [accountPlans, setAccountPlans] = useState<Array<{ id: string; name: string; isPrimary: boolean }>>([]);
  const [invitePlanShares, setInvitePlanShares] = useState<Record<string, string>>({}); // planId -> permission

  // Add Student form state (parent/guardian flow)
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addStudentName, setAddStudentName] = useState("");
  const [addStudentEmail, setAddStudentEmail] = useState("");
  const [addStudentLoading, setAddStudentLoading] = useState(false);

  // Student invite status
  const [studentInviteStatus, setStudentInviteStatus] = useState<{
    status: "none" | "pending" | "accepted" | "expired";
    invite_code?: string;
    expires_at?: string;
  } | null>(null);

  const isParentLike = userRole === "parent" || userRole === "guardian";
  const searchParams = useSearchParams();

  // Auto-open "Add Student" form when navigated via ?add-student=1
  useEffect(() => {
    if (isParentLike && searchParams.get("add-student") === "1") {
      setShowAddStudent(true);
      // Remove the query param so refreshing doesn't re-open the modal
      const url = new URL(window.location.href);
      url.searchParams.delete("add-student");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [isParentLike, searchParams]);

  // Fetch data
  const loadMembers = useCallback(async () => {
    if (!currentAccount?.id) return;
    try {
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/members`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data ?? json;
        const list = Array.isArray(data) ? data : data.members ?? [];
        setMembers(list.map((m: Record<string, unknown>) => ({
          userId: m.user_id ?? m.userId,
          email: m.email,
          firstName: m.first_name ?? m.firstName ?? null,
          lastName: m.last_name ?? m.lastName ?? null,
          role: m.role,
          canEdit: m.can_edit ?? m.canEdit ?? false,
          joinedAt: m.joined_at ?? m.joinedAt ?? "",
          canRemove: m.can_remove ?? m.canRemove ?? false,
        })) as AccountMember[]);
        const invites = Array.isArray(data) ? [] : (data.pending_invites ?? []);
        setPendingInvites((invites as Record<string, unknown>[]).map((inv) => ({
          inviteId: inv.invite_id as string,
          email: (inv.email as string | null) ?? null,
          role: inv.role as string,
          expiresAt: (inv.expires_at as string) ?? "",
          canRevoke: (inv.can_revoke as boolean) ?? false,
        })));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [currentAccount?.id]);

  useEffect(() => {
    loadMembers();
    apiFetch("/api/v1/subscriptions").then((r) => (r.ok ? r.json() : null)).then((json) => {
      const sub = json?.data?.subscription ?? json?.subscription;
      setBillingCycle(sub?.billingCycle ?? null);
      setNextPayment(sub?.currentPeriodEnd ?? null);
      // Derive member limit from plan name (matches middleware logic)
      if (FREE_LAUNCH_MODE) {
        setMemberLimit(LAUNCH_TIER.maxLinkedAccounts);
      } else {
        const plan = (sub?.planName ?? "").toLowerCase();
        if (plan.includes("elite")) setMemberLimit(8);
        else if (plan.includes("plus")) setMemberLimit(5);
        else setMemberLimit(3);
      }
    }).catch(() => {});
    apiFetch("/api/v1/plans").then((r) => (r.ok ? r.json() : null)).then((json) => {
      const plans = json?.data ?? json?.plans ?? json ?? [];
      if (Array.isArray(plans)) {
        // Only list plans the logged-in user owns — they can't grant shares
        // on plans they merely have view/edit access to.
        setAccountPlans(
          plans
            .filter((p: Record<string, unknown>) => p.permission === "owner")
            .map((p: Record<string, unknown>) => ({
              id: p.id as string,
              name: (p.name ?? "Untitled") as string,
              isPrimary: !!(p.isPrimary ?? p.is_primary),
            }))
        );
      }
    }).catch(() => {});
    apiFetch("/api/v1/auth/consent").then((r) => (r.ok ? r.json() : null)).then((json) => {
      setConsentInfo(json?.data?.accepted_documents ?? json?.accepted_documents ?? []);
    }).catch(() => {});
    // Fetch student invite status for parent/guardian
    if (currentAccount?.id && currentAccount.role !== "student") {
      apiFetch(`/api/v1/accounts/${currentAccount.id}/invites`).then((r) => (r.ok ? r.json() : null)).then((json) => {
        const data = json?.data ?? json;
        if (data?.status) setStudentInviteStatus(data);
      }).catch(() => {});
    }
  }, [currentAccount, loadMembers]);

  const otherMembers = members.filter((m) => {
    if (m.email === userEmail) return false;
    // For parents/guardians/counselors, the student is already shown in Student Info
    if ((isParentLike || currentAccount?.role === "counselor") && m.role === "student") return false;
    return true;
  });

  // Handlers
  const handleSaveUserName = async () => {
    if (!editFirstName.trim()) return;
    setSavingUserName(true);
    try {
      const res = await apiFetch("/api/v1/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: editFirstName.trim(), last_name: editLastName.trim() || null }),
      });
      if (res.ok) { await refetchUser(); setEditingUserName(false); showToast("Name updated"); }
    } catch { /* silent */ }
    finally { setSavingUserName(false); }
  };

  const handleUnlinkStudent = async () => {
    if (!currentAccount?.id || !unlinkConfirm) return;
    const selfMember = members.find((m) => m.email === userEmail);
    if (!selfMember) return;
    setUnlinking(true);
    try {
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/members/${selfMember.userId}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Unlinked from ${unlinkConfirm.studentName}'s account.`);
        setUnlinkConfirm(null);
        await refetchAccounts();
        window.location.href = "/settings";
      } else {
        const json = await res.json().catch(() => null);
        showToast(json?.error?.message ?? "Failed to unlink.");
      }
    } catch { /* silent */ }
    finally { setUnlinking(false); }
  };

  const handleRemoveMember = (userId: string, name: string, role: string) => {
    if (!currentAccount?.id) return;

    // When a parent/guardian unlinks a student, show the unlink-student modal
    if (role === "student" && isParentLike) {
      setUnlinkConfirm({ studentName: name });
      return;
    }

    // Show confirmation modal for all other removals
    setRemoveConfirm({ userId, name, role });
  };

  const confirmRemoveMember = async () => {
    if (!currentAccount?.id || !removeConfirm) return;
    setRemovingMember(removeConfirm.userId);
    try {
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/members/${removeConfirm.userId}`, { method: "DELETE" });
      if (res.ok) { setMembers((prev) => prev.filter((m) => m.userId !== removeConfirm.userId)); showToast(`${removeConfirm.name} removed`); }
      else { const json = await res.json().catch(() => null); showToast(json?.error?.message ?? "Failed to remove."); }
    } catch { /* silent */ }
    finally { setRemovingMember(null); setRemoveConfirm(null); }
  };

  const handleRevokePendingMemberInvite = async (inviteId: string, email: string | null) => {
    if (!currentAccount?.id) return;
    setRevokingInvite(inviteId);
    try {
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/invites/${inviteId}`, { method: "DELETE" });
      if (res.ok) {
        showToast(email ? `Invite to ${email} revoked.` : "Pending invite revoked.");
        loadMembers();
      } else {
        const json = await res.json().catch(() => null);
        showToast(json?.error?.message ?? "Couldn't revoke that invite.");
      }
    } catch { showToast("Something went wrong. Please try again."); }
    finally { setRevokingInvite(null); }
  };

  const handleSendInvite = async () => {
    if (!currentAccount?.id || !inviteEmail.trim()) return;
    const recipient = inviteEmail.trim();
    setGenerating(true);
    try {
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_role: inviteRole,
          email: recipient,
          shared_plans: Object.entries(invitePlanShares)
            .filter(([, perm]) => perm !== "none")
            .map(([planId, permission]) => ({ plan_id: planId, permission })),
        }),
      });
      if (res.ok) {
        setInviteEmail(""); setInvitePlanShares({});
        showToast(`Invite emailed to ${recipient}. They'll show up here once they accept.`);
        loadMembers();
      } else {
        const json = await res.json().catch(() => ({}));
        const code = json?.error?.code as string | undefined;
        const baseMsg = json?.error?.message || json?.message || "Failed to send invite.";
        const retryAfter = json?.error?.retry_after as number | undefined;
        const msg = code === "RATE_LIMITED" && typeof retryAfter === "number"
          ? `Too many invite attempts. Try again ${formatRetryAfter(retryAfter)}.`
          : baseMsg;
        showToast(msg);
      }
    } catch { showToast("Something went wrong. Please try again."); }
    finally { setGenerating(false); }
  };

  const handleAddStudent = async () => {
    if (!addStudentName.trim() || !addStudentEmail.trim()) return;
    setAddStudentLoading(true);
    try {
      const res = await apiFetch("/api/v1/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: addStudentName.trim(),
          student_email: addStudentEmail.trim(),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data ?? json;
        if (data.student_exists) {
          showToast(`Invite sent to ${addStudentEmail.trim()}. I'll connect you once they accept.`);
        } else {
          showToast(`Signup invite sent to ${addStudentEmail.trim()}. They can create their account from the link.`);
        }
        setShowAddStudent(false);
        setAddStudentName("");
        setAddStudentEmail("");
        setStudentInviteStatus({ status: "pending", invite_code: data.invite_code });
        await refetchAccounts();
      } else {
        const json = await res.json().catch(() => ({}));
        showToast(json?.error?.message || "Failed to create student account.");
      }
    } catch { showToast("Something went wrong. Please try again."); }
    finally { setAddStudentLoading(false); }
  };

  const handleRevokeInvite = async () => {
    if (!currentAccount?.id) return;
    try {
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/invites`, { method: "DELETE" });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const data = json?.data ?? json;
        if (data?.account_deleted) {
          showToast("Invite revoked and student removed.");
          // Refetch accounts — the deleted account will be gone and
          // AccountContext will switch to the next available account.
          await refetchAccounts();
          // Reload to reset all page state for the new active account
          window.location.href = "/settings";
        } else {
          setStudentInviteStatus({ status: "none" });
          showToast("Invite revoked.");
        }
      } else {
        const json = await res.json().catch(() => ({}));
        showToast(json?.error?.message || "Failed to revoke invite.");
      }
    } catch { showToast("Something went wrong."); }
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== "DELETE") return;
    setDeleting(true);
    try {
      if (exportOnDelete) {
        const exportRes = await apiFetch("/api/v1/users/me");
        if (exportRes.ok) {
          const data = await exportRes.json();
          const blob = new Blob([JSON.stringify(data.data ?? data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url;
          a.download = `saps-data-export-${new Date().toISOString().split("T")[0]}.json`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(url);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
      const res = await apiFetch("/api/v1/users/me", { method: "DELETE" });
      if (res.ok) window.location.href = "/login";
    } catch { /* silent */ }
    finally { setDeleting(false); }
  };

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { showToast("Password must be at least 8 characters."); return; }
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^a-zA-Z0-9]/.test(newPassword)) {
      showToast("Password must include lowercase, uppercase, number, and special character."); return;
    }
    if (newPassword !== confirmNewPassword) { showToast("Passwords do not match."); return; }

    setPasswordLoading(true);
    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { showToast(error.message || "Failed to update password."); return; }
      showToast("Password updated.");
      setShowPasswordForm(false);
      setNewPassword("");
      setConfirmNewPassword("");
    } catch { showToast("Failed to update password."); }
    finally { setPasswordLoading(false); }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "student": return "bg-primary/15 text-primary";
      case "parent": case "guardian": return "bg-success/15 text-success";
      case "counselor": return "bg-purple-500/15 text-purple-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const expiresInLabel = (expiresAt: string): string => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (Number.isNaN(ms)) return "Expires soon";
    const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    if (days === 0) return "Expires today";
    if (days === 1) return "Expires in 1 day";
    return `Expires in ${days} days`;
  };

  const formatRetryAfter = (seconds: number): string => {
    if (seconds <= 60) return "in a moment";
    const mins = Math.ceil(seconds / 60);
    if (mins < 60) return `in ${mins} minute${mins === 1 ? "" : "s"}`;
    const hours = Math.ceil(mins / 60);
    return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  };

  const tierColor = currentAccount?.subscriptionTier === "elite" ? "bg-purple-500/10 text-purple-600" :
    currentAccount?.subscriptionTier === "plus" ? "bg-primary/10 text-primary" :
    currentAccount?.subscriptionTier === "trial" ? "bg-warning/10 text-warning" :
    "bg-muted text-muted-foreground";

  const tierLabel = currentAccount?.subscriptionTier === "trial" ? "Free Trial" :
    (currentAccount?.subscriptionTier ?? "starter").charAt(0).toUpperCase() +
    (currentAccount?.subscriptionTier ?? "starter").slice(1);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Page shell header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
            {(userFirstName ?? userEmail ?? "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {[userFirstName, userLastName].filter(Boolean).join(" ") || "Settings"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{userEmail}</p>
          </div>
        </div>
      </div>

      <div className="space-y-10">

        {/* --- Onboarding banner for students ----------------------- */}
        {!onboardingCompleted && (currentAccount?.role ?? userRole) === "student" && (
          <div
            className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-light p-4 sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div className="flex items-start gap-3">
              <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
              </svg>
              <div>
                <p className="font-semibold text-primary">Complete your onboarding</p>
                <p className="text-sm text-muted-foreground">Set up your profile, add past courses, and create your first plan to get the most out of Genie.</p>
              </div>
            </div>
            <Link href="/onboarding" className="sm:shrink-0">
              <Button size="sm">Start Onboarding</Button>
            </Link>
          </div>
        )}

        {/* --- Profile & Academic ----------------------------------- */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile</h2>

          {/* Name edit mode */}
          {editingUserName ? (
            <Card className="mb-4">
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">First name</label>
                    <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)}
                      className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" autoFocus />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Last name</label>
                    <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)}
                      className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setEditingUserName(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveUserName} disabled={!editFirstName.trim() || savingUserName}>
                      {savingUserName ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Password edit mode */}
          {showPasswordForm ? (
            <Card className="mb-4">
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Input label="New password" type="password" autoComplete="new-password" value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" autoFocus />
                  </div>
                  <div className="flex-1">
                    <Input label="Confirm password" type="password" autoComplete="new-password" value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Confirm new password" />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => { setShowPasswordForm(false); setNewPassword(""); setConfirmNewPassword(""); }}>Cancel</Button>
                    <Button size="sm" onClick={handleChangePassword} disabled={passwordLoading || !newPassword}>
                      {passwordLoading ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent>
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
                <div className="flex items-start justify-between sm:block">
                  <p className="text-xs text-muted-foreground">Name</p>
                  {!editingUserName ? (
                    <button type="button" onClick={() => { setEditFirstName(userFirstName ?? ""); setEditLastName(userLastName ?? ""); setEditingUserName(true); }}
                      className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded">
                      {[userFirstName, userLastName].filter(Boolean).join(" ") || "Not set"}
                      <svg aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                      </svg>
                    </button>
                  ) : <p className="mt-0.5 text-sm text-muted-foreground/50">Editing...</p>}
                </div>
                <div className="flex items-start justify-between sm:block">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{userEmail ?? "---"}</p>
                </div>
                <div className="flex items-start justify-between sm:block">
                  <p className="text-xs text-muted-foreground">Password</p>
                  {!showPasswordForm ? (
                    <button type="button" onClick={() => setShowPasswordForm(true)}
                      className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded">
                      --------
                      <svg aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                      </svg>
                    </button>
                  ) : <p className="mt-0.5 text-sm text-muted-foreground/50">Editing...</p>}
                </div>
                <div className="flex items-start justify-between sm:block">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <div className="mt-1"><Badge className={roleColor(currentAccount?.role ?? userRole ?? "student")}>{currentAccount?.role ?? userRole ?? "student"}</Badge></div>
                </div>
                {(currentAccount?.role ?? userRole) === "student" && (
                  <>
                    <div className="flex items-start justify-between sm:block">
                      <p className="text-xs text-muted-foreground">Grade</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{onboardingCompleted ? (currentAccount?.gradeLevel ?? "---") : "---"}</p>
                    </div>
                    <div className="flex items-start justify-between sm:block">
                      <p className="text-xs text-muted-foreground">Graduation</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{onboardingCompleted ? (currentAccount?.graduationYear ?? "---") : "---"}</p>
                    </div>
                    <div className="flex items-start justify-between sm:block">
                      <p className="text-xs text-muted-foreground">State</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">
                        {US_STATES.find((s) => s.code === currentAccount?.state)?.name ?? currentAccount?.state ?? "---"}
                      </p>
                    </div>
                    <div className="flex items-start justify-between sm:block">
                      <p className="text-xs text-muted-foreground">School</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{currentAccount?.schoolName ?? "---"}</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

        </section>

        {/* --- Student Info (parent/guardian/counselor — non-student roles) */}
        {(isParentLike || currentAccount?.role === "counselor") && (
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student info</h2>
            {currentAccount ? (
              <Card>
                <CardContent>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Student</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">
                        {[currentAccount.studentFirstName, currentAccount.studentLastName].filter(Boolean).join(" ") || currentAccount.studentName || "---"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{members.find((m) => m.role === "student")?.email ?? "---"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Grade</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{currentAccount.gradeLevel ?? "---"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Graduation</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{currentAccount.graduationYear ?? "---"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">State</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">
                        {US_STATES.find((s) => s.code === currentAccount.state)?.name ?? currentAccount.state ?? "---"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">School</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{currentAccount.schoolName ?? "---"}</p>
                    </div>
                    {!members.some((m) => m.role === "student") && (
                    <div>
                      <p className="text-xs text-muted-foreground">Invite Status</p>
                      <div className="mt-1">
                        {studentInviteStatus?.status === "pending" ? (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-warning/15 text-warning text-[11px]">
                              <svg aria-hidden="true" className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                              Invite Pending
                            </Badge>
                            {isParentLike && (
                              <button type="button" onClick={handleRevokeInvite}
                                className="text-[11px] text-destructive hover:text-destructive/80 hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded">
                                Revoke
                              </button>
                            )}
                          </div>
                        ) : studentInviteStatus?.status === "expired" ? (
                          <Badge className="bg-destructive/15 text-destructive text-[11px]">
                            <svg aria-hidden="true" className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                            </svg>
                            Invite Expired
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not invited</span>
                        )}
                      </div>
                    </div>
                    )}
                  </div>
                  {isParentLike && (
                    <div className="mt-4 border-t border-border pt-4">
                      <button type="button" onClick={() => setShowAddStudent(true)}
                        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded">
                        <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Another Student
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : isParentLike ? (
              <Card>
                <CardContent>
                  <div className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">No students added yet.</p>
                    <Button size="sm" className="mt-4 min-h-[44px]" onClick={() => setShowAddStudent(true)}>
                      Add student
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent>
                  <p className="py-6 text-center text-sm text-muted-foreground">No student information available yet.</p>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* --- Shared With ------------------------------------ */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Shared with
            </h2>
            {(otherMembers.length + pendingInvites.length) > 0 && (
              <Badge className="bg-muted text-muted-foreground">{otherMembers.length + pendingInvites.length}</Badge>
            )}
          </div>

          <Card>
            <CardContent>
              {loading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-12 rounded-lg bg-muted" />
                  <div className="h-12 rounded-lg bg-muted" />
                </div>
              ) : (
                <div className="space-y-1">
                  {otherMembers.map((m, idx) => (
                    <div key={m.userId} className={`flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-muted/40 transition-colors ${idx < otherMembers.length - 1 || pendingInvites.length > 0 ? "border-b border-border/50" : ""}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                          {(m.firstName ?? m.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email}
                            </p>
                            <Badge className={`${roleColor(m.role)} text-[9px]`}>{m.role}</Badge>
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                      {m.canRemove && (
                        <button type="button" onClick={() => handleRemoveMember(m.userId, [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email, m.role)}
                          disabled={removingMember === m.userId}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive-light transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          title={m.role === "student" ? "Unlink" : "Remove"}>
                          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}

                  {pendingInvites.map((inv, idx) => {
                    const label = inv.email ?? "Pending invite";
                    return (
                      <div key={inv.inviteId} className={`flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-muted/40 transition-colors ${idx < pendingInvites.length - 1 ? "border-b border-border/50" : ""}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-muted/30 text-muted-foreground">
                            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-foreground">{label}</p>
                              <Badge className={`${roleColor(inv.role)} text-[9px]`}>{inv.role}</Badge>
                              <Badge className="bg-warning/15 text-warning text-[9px]">Pending</Badge>
                            </div>
                            <p className="truncate text-[11px] text-muted-foreground">{expiresInLabel(inv.expiresAt)}</p>
                          </div>
                        </div>
                        {inv.canRevoke && (
                          <button type="button" onClick={() => handleRevokePendingMemberInvite(inv.inviteId, inv.email)}
                            disabled={revokingInvite === inv.inviteId}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive-light transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            title="Revoke invite">
                            <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {otherMembers.length === 0 && pendingInvites.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">Not shared with anyone yet.</p>
                  )}

                  {/* Invite -- hidden for counselors (view-only role) */}
                  {currentAccount?.role !== "counselor" && (() => {
                    const totalMembers = members.length; // includes self
                    const atLimit = totalMembers >= memberLimit;
                    const onboardingBlocked =
                      (currentAccount?.role ?? userRole) === "student" && !onboardingCompleted;
                    const inviteDisabled = atLimit || onboardingBlocked;

                    return (
                    <>
                      {otherMembers.length > 0 && <div className="my-2 border-t border-border" />}
                      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
                        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                          disabled={inviteDisabled}
                          className={`min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${inviteDisabled ? "opacity-50" : ""}`}>
                          {/* v1-hide: counselor option removed; re-add <option value="counselor">Counselor</option> to restore. */}
                          <option value="parent">Parent</option>
                          <option value="guardian">Guardian</option>
                        </select>
                        <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Invite by email..."
                          disabled={inviteDisabled}
                          className={`min-h-[44px] flex-1 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${inviteDisabled ? "opacity-50" : ""}`} />
                        <Button size="sm" className="min-h-[44px] w-full shrink-0 sm:w-auto" onClick={handleSendInvite} disabled={generating || !inviteEmail.trim() || inviteDisabled}>
                          {generating ? "Sending..." : "Send Invite"}
                        </Button>
                      </div>

                      {/* Plan sharing selector */}
                      {accountPlans.length > 0 && !atLimit && (
                        <div className="mt-2 rounded-lg border border-border p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Share plans</p>
                          <div className="space-y-2">
                            {accountPlans.map((plan) => (
                              <div key={plan.id} className="flex items-center justify-between gap-3">
                                <label className="flex items-center gap-2 text-sm text-foreground min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={!!invitePlanShares[plan.id] && invitePlanShares[plan.id] !== "none"}
                                    onChange={(e) => {
                                      setInvitePlanShares((prev) => {
                                        const next = { ...prev };
                                        if (e.target.checked) {
                                          next[plan.id] = "view";
                                        } else {
                                          delete next[plan.id];
                                        }
                                        return next;
                                      });
                                    }}
                                    className="h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                  />
                                  <span className="truncate">{plan.name}{plan.isPrimary ? " \u2605" : ""}</span>
                                </label>
                                {invitePlanShares[plan.id] && invitePlanShares[plan.id] !== "none" && (
                                  <select
                                    value={invitePlanShares[plan.id]}
                                    onChange={(e) => setInvitePlanShares((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                                    className="rounded-md border border-border bg-background px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                  >
                                    <option value="view">View only</option>
                                    <option value="edit">Can edit</option>
                                  </select>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Badge className="bg-muted text-muted-foreground text-[11px]">{totalMembers}/{memberLimit} used</Badge>
                        {atLimit && (
                          <span className="text-[11px] text-warning">
                            Limit reached.{!FREE_LAUNCH_MODE && <>{" "}<Link href="/settings/billing" className="text-primary hover:underline">Upgrade</Link> for more.</>}
                          </span>
                        )}
                      </div>
                    </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* --- Subscription (hidden in free launch mode and for counselors) ---- */}
        {!FREE_LAUNCH_MODE && currentAccount?.role !== "counselor" && <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscription</h2>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className={tierColor}>{tierLabel}</Badge>
                  {billingCycle && currentAccount?.subscriptionTier !== "trial" && currentAccount?.subscriptionTier !== "starter" && (
                    <span className="text-xs text-muted-foreground">
                      {billingCycle === "four_year" ? "4-Year" : billingCycle === "annual" ? "Annual" : "Monthly"}
                    </span>
                  )}
                  {nextPayment && currentAccount?.subscriptionTier !== "trial" && currentAccount?.subscriptionTier !== "starter" && (
                    <span className="text-xs text-muted-foreground">
                      {billingCycle === "four_year" ? "Expires" : "Renews"} {new Date(nextPayment).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
                <Link href="/settings/billing">
                  <Button variant="outline" size="sm">Manage</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>}

        {/* --- Legal ------------------------------------------------ */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal</h2>
          <Card>
            <CardContent>
              <div className="space-y-2">
                {(() => {
                  const reviewable = consentInfo.filter(
                    (c) => c.type === "terms_of_service" || c.type === "privacy_policy"
                  );
                  return reviewable.length > 0 ? reviewable.map((c) => (
                    <div key={c.type} className="flex items-center justify-between py-1.5">
                      <Link href={c.type === "terms_of_service" ? "/terms" : "/privacy"} target="_blank"
                        className="text-sm text-primary hover:underline">
                        {c.type === "terms_of_service" ? "Terms of Service" : "Privacy Policy"}
                        <span className="ml-1 text-xs text-muted-foreground">v{c.version}</span>
                      </Link>
                      <Badge className="bg-success/10 text-success text-[11px]">
                        Accepted {new Date(c.accepted_at).toLocaleDateString()}
                      </Badge>
                    </div>
                  )) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-1.5">
                      <Link href="/terms" target="_blank" className="text-sm text-primary hover:underline">Terms of Service</Link>
                      <span className="text-xs text-muted-foreground">Not yet accepted</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <Link href="/privacy" target="_blank" className="text-sm text-primary hover:underline">Privacy Policy</Link>
                      <span className="text-xs text-muted-foreground">Not yet accepted</span>
                    </div>
                  </div>
                );
                })()}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* --- Danger Zone ------------------------------------------ */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-destructive">Danger zone</h2>
          <div className="rounded-xl border border-destructive/30 bg-destructive-light/30 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Delete account</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Permanently remove your account and all data. This cannot be undone.</p>
              </div>
              <Button variant="destructive" size="sm" className="min-h-[44px] shrink-0" onClick={() => setDeleteConfirm(true)}>
                Delete Account
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* --- Delete Confirmation Modal ------------------------------ */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setDeleteConfirm(false)} aria-hidden="true" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-card shadow-xl" role="alertdialog" aria-modal="true"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive-light">
                    <svg aria-hidden="true" className="h-5 w-5 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Delete your account?</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This will permanently delete your account, all plans, grades, and data. This cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={exportOnDelete} onChange={(e) => setExportOnDelete(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary" />
                    <span className="text-sm text-foreground">Download my data before deleting</span>
                  </label>
                  <div>
                    <label htmlFor="delete-confirm" className="block text-sm font-medium text-foreground">
                      Type <strong>DELETE</strong> to confirm
                    </label>
                    <input id="delete-confirm" type="text" value={deleteText} onChange={(e) => setDeleteText(e.target.value)}
                      placeholder="DELETE" className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => { setDeleteConfirm(false); setDeleteText(""); }}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteAccount} disabled={deleteText !== "DELETE" || deleting}>
                  {deleting ? "Deleting..." : "Delete my account"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- Unlink Student Confirmation Modal ---------------------- */}
      {unlinkConfirm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => { if (!unlinking) setUnlinkConfirm(null); }} aria-hidden="true" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-card shadow-xl" role="alertdialog" aria-modal="true"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive-light">
                    <svg aria-hidden="true" className="h-5 w-5 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Unlink from {unlinkConfirm.studentName}?</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This will remove you from {unlinkConfirm.studentName}&apos;s account. You will lose access to their plans, grades, and data. This cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => setUnlinkConfirm(null)} disabled={unlinking}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={handleUnlinkStudent} disabled={unlinking}>
                  {unlinking ? "Unlinking..." : "Unlink"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- Remove Member Confirmation Modal ----------------------- */}
      {removeConfirm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => { if (!removingMember) setRemoveConfirm(null); }} aria-hidden="true" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-card shadow-xl" role="alertdialog" aria-modal="true"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive-light">
                    <svg aria-hidden="true" className="h-5 w-5 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Remove {removeConfirm.name}?</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This will remove {removeConfirm.name} from this account. They will lose access to all plans and data. This cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => setRemoveConfirm(null)} disabled={!!removingMember}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={confirmRemoveMember} disabled={!!removingMember}>
                  {removingMember ? "Removing..." : "Remove"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- Add Student Modal ------------------------------------- */}
      {showAddStudent && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowAddStudent(false)} aria-hidden="true" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-card shadow-xl" role="dialog" aria-modal="true" aria-label="Add student"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <h3 className="text-base font-semibold text-foreground">Add student</h3>
                <p className="mt-1 text-sm text-muted-foreground">Create a student profile. You can invite them to claim their account afterwards.</p>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Student&apos;s full name</label>
                    <input type="text" value={addStudentName} onChange={(e) => setAddStudentName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" autoFocus />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Student&apos;s email</label>
                    <input type="email" value={addStudentEmail} onChange={(e) => setAddStudentEmail(e.target.value)}
                      placeholder="e.g. jane@example.com"
                      className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
                    <p className="mt-1 text-[11px] text-muted-foreground">An invite will be sent to this email so they can access their account.</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => setShowAddStudent(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddStudent}
                  disabled={addStudentLoading || !addStudentName.trim() || !addStudentEmail.trim()}>
                  {addStudentLoading ? "Creating..." : "Add student"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
