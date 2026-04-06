"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

interface AccountMember {
  userId: string;
  email: string;
  role: string;
  canEdit: boolean;
  joinedAt: string;
}

interface InviteCode {
  code: string;
  targetRole: string;
  expiresAt: string;
  claimedBy: string | null;
}

export default function SettingsPage() {
  const { currentAccount, refetchAccounts, userEmail } = useAccount();
  const { showToast } = useToast();
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState("parent");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generating, setGenerating] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [consentInfo, setConsentInfo] = useState<Array<{ type: string; version: string; accepted_at: string }>>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [exportOnDelete, setExportOnDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [billingCycle, setBillingCycle] = useState<string | null>(null);
  const [nextPayment, setNextPayment] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["account"]));

  const toggleSection = (section: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  useEffect(() => {
    async function fetchMembers() {
      if (!currentAccount?.id) return;
      try {
        const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/members`);
        if (res.ok) {
          const json = await res.json();
          const data = json.data ?? json;
          setMembers(Array.isArray(data) ? data : data.members ?? []);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    fetchMembers();

    // Fetch subscription billing cycle
    apiFetch("/api/v1/subscriptions")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const sub = json?.data?.subscription ?? json?.subscription;
        setBillingCycle(sub?.billingCycle ?? null);
        setNextPayment(sub?.currentPeriodEnd ?? null);
      })
      .catch(() => {});

    // Fetch consent info
    apiFetch("/api/v1/auth/consent")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const data = json?.data ?? json;
        setConsentInfo(data?.accepted_documents ?? []);
      })
      .catch(() => {});
  }, [currentAccount]);

  const handleDeleteAccount = async () => {
    if (deleteText !== "DELETE") return;
    setDeleting(true);
    try {
      // Export data first if requested
      if (exportOnDelete) {
        const exportRes = await apiFetch("/api/v1/users/me");
        if (exportRes.ok) {
          const data = await exportRes.json();
          const blob = new Blob([JSON.stringify(data.data ?? data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `saps-data-export-${new Date().toISOString().split("T")[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          // Wait for download to start before proceeding with deletion
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      const res = await apiFetch("/api/v1/users/me", { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/login";
      }
    } catch { /* silent */ }
    finally { setDeleting(false); }
  };

  const handleSaveName = async () => {
    if (!currentAccount?.id || !editName.trim()) return;
    setSavingName(true);
    try {
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_name: editName.trim() }),
      });
      if (res.ok) {
        await refetchAccounts();
        setEditingName(false);
        showToast("Name updated");
      }
    } catch { /* silent */ }
    finally { setSavingName(false); }
  };

  const handleRemoveMember = async (userId: string, email: string) => {
    if (!currentAccount?.id) return;
    if (!confirm(`Remove ${email} from this account?`)) return;
    setRemovingMember(userId);
    try {
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/members/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        showToast(`${email} removed`);
      } else {
        const json = await res.json().catch(() => null);
        showToast(json?.error?.message ?? "Failed to remove member.");
      }
    } catch { /* silent */ }
    finally { setRemovingMember(null); }
  };

  const handleSendInvite = async () => {
    if (!currentAccount?.id || !inviteEmail.trim()) return;
    setGenerating(true);
    setInviteSent(false);
    try {
      // Generate invite code
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_role: inviteRole, email: inviteEmail.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data ?? json;
        setInviteCode(data.invite_code ?? data.code ?? null);
        setInviteSent(true);
        setInviteEmail("");
      }
    } catch { /* silent */ }
    finally { setGenerating(false); }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "student": return "bg-primary/15 text-primary";
      case "parent": return "bg-success/15 text-success";
      case "guardian": return "bg-success/15 text-success";
      case "counselor": return "bg-purple-500/15 text-purple-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const otherMembers = members.filter((m) => m.email !== userEmail);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Settings</h1>

      <div className="space-y-6">
        {/* Account Info */}
        <Card>
          <button type="button" onClick={() => toggleSection("account")} className="flex w-full items-center justify-between px-6 py-4 text-left">
            <h2 className="text-lg font-semibold text-foreground">Account</h2>
            <svg aria-hidden="true" className={`h-5 w-5 text-muted-foreground transition-transform ${expanded.has("account") ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
          </button>
          {expanded.has("account") && <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Username</span>
                <span className="text-sm font-medium text-foreground">{userEmail ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Password</span>
                <button
                  type="button"
                  onClick={async () => {
                    if (!userEmail) return;
                    try {
                      const { createClient } = await import("@supabase/supabase-js");
                      const supabase = createClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                      );
                      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
                        redirectTo: `${window.location.origin}/login?reset=true`,
                      });
                      if (!error) {
                        showToast("Password reset email sent. Check your inbox.");
                      } else {
                        showToast("Failed to send reset email. Try again.");
                      }
                    } catch {
                      showToast("Failed to send reset email.");
                    }
                  }}
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                >
                  ••••••••
                  <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                  </svg>
                  Reset
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Student Name</span>
                {editingName && currentAccount?.role === "student" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 w-40 rounded border border-border bg-background px-2 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editName.trim()) handleSaveName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                    />
                    <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveName} disabled={!editName.trim() || savingName}>
                      {savingName ? "Saving..." : "Save"}
                    </Button>
                  </div>
                ) : currentAccount?.role === "student" ? (
                  <button
                    type="button"
                    onClick={() => { setEditName(currentAccount?.studentName ?? ""); setEditingName(true); }}
                    className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors"
                    title="Click to edit"
                  >
                    {currentAccount?.studentName ?? "—"}
                    <svg aria-hidden="true" className="h-3 w-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                    </svg>
                  </button>
                ) : (
                  <span className="text-sm font-medium text-foreground">{currentAccount?.studentName ?? "—"}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Grade Level</span>
                <span className="text-sm font-medium text-foreground">{currentAccount?.gradeLevel ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Graduation Year</span>
                <span className="text-sm font-medium text-foreground">{currentAccount?.graduationYear ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your Role</span>
                <Badge className={roleColor(currentAccount?.role ?? "student")}>
                  {currentAccount?.role ?? "student"}
                </Badge>
              </div>
            </div>
          </CardContent>}
        </Card>

        {/* Family Members */}
        <Card>
          <button type="button" onClick={() => toggleSection("family")} className="flex w-full items-center justify-between px-6 py-4 text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Family Members</h2>
              <Badge className="bg-muted text-muted-foreground text-[10px]">{otherMembers.length}</Badge>
            </div>
            <svg aria-hidden="true" className={`h-5 w-5 text-muted-foreground transition-transform ${expanded.has("family") ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
          </button>
          {expanded.has("family") && <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-10 rounded bg-muted" />
                <div className="h-10 rounded bg-muted" />
              </div>
            ) : (
              <>
                {otherMembers.length > 0 ? (
                  <div className="space-y-2">
                    {otherMembers.map((m) => (
                      <div key={m.userId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                            {m.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{m.email}</p>
                            <p className="text-[10px] text-muted-foreground">Joined {new Date(m.joinedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${roleColor(m.role)} text-[10px]`}>{m.role}</Badge>
                          {m.canEdit && <Badge className="bg-muted text-muted-foreground text-[10px]">Can edit</Badge>}
                          {m.role !== "student" && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.userId, m.email)}
                              disabled={removingMember === m.userId}
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive-light transition-colors"
                              title={`Remove ${m.email}`}
                            >
                              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="pb-3 text-sm text-muted-foreground">No other family members yet. Invite someone below.</p>
                )}

                <div className="mt-6">
                  <p className="mb-2 text-sm font-medium text-foreground">Invite a family member</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Email address"
                      className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                    >
                      {currentAccount?.role === "parent" && <option value="student">Child (Student)</option>}
                      <option value="parent">Parent</option>
                      <option value="guardian">Guardian</option>
                    </select>
                    <Button onClick={handleSendInvite} disabled={generating || !inviteEmail.trim()}>
                      {generating ? "Sending..." : "Send Invite"}
                    </Button>
                  </div>

                  {inviteSent && inviteCode && (
                    <div className="mt-3 rounded-lg border border-success/30 bg-success/5 p-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-success">
                        <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        Invitation sent!
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        An email with a join link has been sent. The invite expires in 7 days.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Invite code: <span className="font-mono font-semibold text-foreground">{inviteCode}</span> (can also be shared manually)
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>}
        </Card>

        {/* Billing link */}
        <Card>
          <button type="button" onClick={() => toggleSection("billing")} className="flex w-full items-center justify-between px-6 py-4 text-left">
            <h2 className="text-lg font-semibold text-foreground">Billing & Subscription</h2>
            <svg aria-hidden="true" className={`h-5 w-5 text-muted-foreground transition-transform ${expanded.has("billing") ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
          </button>
          {expanded.has("billing") && <CardContent>
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground">Current plan:</p>
              <Badge className={
                currentAccount?.subscriptionTier === "elite" ? "bg-purple-500/10 text-purple-600" :
                currentAccount?.subscriptionTier === "plus" ? "bg-primary/10 text-primary" :
                currentAccount?.subscriptionTier === "trial" ? "bg-warning/10 text-warning" :
                "bg-muted text-muted-foreground"
              }>
                {currentAccount?.subscriptionTier === "trial" ? "Free Trial" :
                 (currentAccount?.subscriptionTier ?? "starter").charAt(0).toUpperCase() +
                 (currentAccount?.subscriptionTier ?? "starter").slice(1)}
              </Badge>
              {billingCycle && currentAccount?.subscriptionTier !== "trial" && currentAccount?.subscriptionTier !== "starter" && (
                <span className="text-xs text-muted-foreground">
                  ({billingCycle === "four_year" ? "4-Year" : billingCycle === "annual" ? "Annual" : "Monthly"})
                </span>
              )}
            </div>
            {nextPayment && currentAccount?.subscriptionTier !== "trial" && currentAccount?.subscriptionTier !== "starter" && (
              <p className="mb-3 text-xs text-muted-foreground">
                Next payment: {new Date(nextPayment).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            )}
            <Link href="/settings/billing">
              <Button variant="outline">Manage Billing</Button>
            </Link>
          </CardContent>}
        </Card>
        {/* Legal */}
        <Card>
          <button type="button" onClick={() => toggleSection("legal")} className="flex w-full items-center justify-between px-6 py-4 text-left">
            <h2 className="text-lg font-semibold text-foreground">Legal</h2>
            <svg aria-hidden="true" className={`h-5 w-5 text-muted-foreground transition-transform ${expanded.has("legal") ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
          </button>
          {expanded.has("legal") && <CardContent>
            <div className="space-y-3">
              {consentInfo.length > 0 ? (
                consentInfo.map((c) => (
                  <div key={c.type} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {c.type === "terms_of_service" ? "Terms of Service" : "Privacy Policy"} v{c.version}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Accepted {new Date(c.accepted_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No consent records found.</p>
              )}
              <div className="flex gap-3 pt-2">
                <Link href="/terms" className="text-sm text-primary hover:underline">Terms of Service</Link>
                <Link href="/privacy" className="text-sm text-primary hover:underline">Privacy Policy</Link>
              </div>
            </div>
          </CardContent>}
        </Card>

        {/* Delete Account */}
        <Card className="border-destructive/30">
          <button type="button" onClick={() => toggleSection("delete")} className="flex w-full items-center justify-between px-6 py-4 text-left">
            <h2 className="text-lg font-semibold text-destructive">Delete Account</h2>
            <svg aria-hidden="true" className={`h-5 w-5 text-muted-foreground transition-transform ${expanded.has("delete") ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
          </button>
          {expanded.has("delete") && <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>
              Delete my account
            </Button>
          </CardContent>}
        </Card>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setDeleteConfirm(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-xl bg-card shadow-xl"
              role="alertdialog"
              aria-modal="true"
              aria-label="Delete account confirmation"
              onClick={(e) => e.stopPropagation()}
            >
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
                      This will permanently delete your account, all plans, grades, and associated data.
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOnDelete}
                      onChange={(e) => setExportOnDelete(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary"
                    />
                    <span className="text-sm text-foreground">Download a copy of my data before deleting</span>
                  </label>

                  <div>
                    <label htmlFor="delete-confirm" className="block text-sm font-medium text-foreground">
                      Type <strong>DELETE</strong> to confirm
                    </label>
                    <input
                      id="delete-confirm"
                      type="text"
                      value={deleteText}
                      onChange={(e) => setDeleteText(e.target.value)}
                      placeholder="DELETE"
                      className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => { setDeleteConfirm(false); setDeleteText(""); }}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleteText !== "DELETE" || deleting}
                >
                  {deleting ? "Deleting..." : "Delete my account"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
