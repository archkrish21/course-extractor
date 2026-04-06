"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { US_STATES } from "@/config/us-states";
import Link from "next/link";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

interface AccountMember {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  canEdit: boolean;
  joinedAt: string;
}

export default function SettingsPage() {
  const { currentAccount, refetchAccounts, userEmail, userFirstName, userLastName, refetchUser } = useAccount();
  const { showToast } = useToast();

  // State
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserName, setEditingUserName] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [savingUserName, setSavingUserName] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("parent");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [consentInfo, setConsentInfo] = useState<Array<{ type: string; version: string; accepted_at: string }>>([]);
  const [billingCycle, setBillingCycle] = useState<string | null>(null);
  const [nextPayment, setNextPayment] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [exportOnDelete, setExportOnDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch data
  useEffect(() => {
    async function fetchMembers() {
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
          })) as AccountMember[]);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    fetchMembers();
    apiFetch("/api/v1/subscriptions").then((r) => (r.ok ? r.json() : null)).then((json) => {
      const sub = json?.data?.subscription ?? json?.subscription;
      setBillingCycle(sub?.billingCycle ?? null);
      setNextPayment(sub?.currentPeriodEnd ?? null);
    }).catch(() => {});
    apiFetch("/api/v1/auth/consent").then((r) => (r.ok ? r.json() : null)).then((json) => {
      setConsentInfo(json?.data?.accepted_documents ?? json?.accepted_documents ?? []);
    }).catch(() => {});
  }, [currentAccount]);

  const otherMembers = members.filter((m) => m.email !== userEmail);

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

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!currentAccount?.id || !confirm(`Remove ${name} from this account?`)) return;
    setRemovingMember(userId);
    try {
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/members/${userId}`, { method: "DELETE" });
      if (res.ok) { setMembers((prev) => prev.filter((m) => m.userId !== userId)); showToast(`${name} removed`); }
      else { const json = await res.json().catch(() => null); showToast(json?.error?.message ?? "Failed to remove."); }
    } catch { /* silent */ }
    finally { setRemovingMember(null); }
  };

  const handleSendInvite = async () => {
    if (!currentAccount?.id || !inviteEmail.trim()) return;
    setGenerating(true); setInviteSent(false);
    try {
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_role: inviteRole, email: inviteEmail.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        setInviteCode(json.data?.invite_code ?? json.data?.code ?? null);
        setInviteSent(true); setInviteEmail("");
      }
    } catch { /* silent */ }
    finally { setGenerating(false); }
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

  const handleResetPassword = async () => {
    if (!userEmail) return;
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, { redirectTo: `${window.location.origin}/login?reset=true` });
      showToast(error ? "Failed to send reset email." : "Password reset email sent. Check your inbox.");
    } catch { showToast("Failed to send reset email."); }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "student": return "bg-primary/15 text-primary";
      case "parent": case "guardian": return "bg-success/15 text-success";
      case "counselor": return "bg-purple-500/15 text-purple-600";
      default: return "bg-muted text-muted-foreground";
    }
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
      {/* Header with avatar */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
          {(userFirstName ?? userEmail ?? "U").charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {[userFirstName, userLastName].filter(Boolean).join(" ") || "Settings"}
          </h1>
          <p className="text-sm text-muted-foreground">{userEmail}</p>
        </div>
      </div>

      <div className="space-y-10">

        {/* ─── Profile & Academic ───────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Profile</h2>

          {/* Name edit mode */}
          {editingUserName ? (
            <div className="mb-4 rounded-lg bg-muted/30 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">First name</label>
                  <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" autoFocus />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Last name</label>
                  <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setEditingUserName(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveUserName} disabled={!editFirstName.trim() || savingUserName}>
                    {savingUserName ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              {!editingUserName ? (
                <button type="button" onClick={() => { setEditFirstName(userFirstName ?? ""); setEditLastName(userLastName ?? ""); setEditingUserName(true); }}
                  className="mt-0.5 flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors">
                  {[userFirstName, userLastName].filter(Boolean).join(" ") || "Not set"}
                  <svg aria-hidden="true" className="h-3 w-3 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                  </svg>
                </button>
              ) : <p className="mt-0.5 text-sm text-muted-foreground/50">Editing...</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{userEmail ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Password</p>
              <button type="button" onClick={handleResetPassword}
                className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors">
                ••••••••
                <span className="text-[11px] font-medium text-primary">Reset</span>
              </button>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <div className="mt-1"><Badge className={roleColor(currentAccount?.role ?? "student")}>{currentAccount?.role ?? "student"}</Badge></div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Grade</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{currentAccount?.gradeLevel ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Graduation</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{currentAccount?.graduationYear ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">State</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {US_STATES.find((s) => s.code === currentAccount?.state)?.name ?? currentAccount?.state ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">School</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{currentAccount?.schoolName ?? "—"}</p>
            </div>
          </div>
        </section>

        {/* ─── Family Members ───────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Family Members
            {otherMembers.length > 0 && <span className="ml-1 text-muted-foreground/50">({otherMembers.length})</span>}
          </h2>

          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-12 rounded-lg bg-muted" />
              <div className="h-12 rounded-lg bg-muted" />
            </div>
          ) : (
            <div className="space-y-2">
              {otherMembers.map((m) => (
                <div key={m.userId} className="flex items-center justify-between rounded-lg py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                      {(m.firstName ?? m.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email}
                        </p>
                        <Badge className={`${roleColor(m.role)} text-[9px]`}>{m.role}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleRemoveMember(m.userId, [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email)}
                    disabled={removingMember === m.userId}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive-light transition-colors"
                    title="Remove">
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {otherMembers.length === 0 && (
                <p className="py-2 text-sm text-muted-foreground">No family members linked yet.</p>
              )}

              {/* Invite */}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Invite by email..."
                  className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
                  {currentAccount?.role === "parent" && <option value="student">Child</option>}
                  <option value="parent">Parent</option>
                  <option value="guardian">Guardian</option>
                </select>
                <Button size="sm" onClick={handleSendInvite} disabled={generating || !inviteEmail.trim()}>
                  {generating ? "Sending..." : "Invite"}
                </Button>
              </div>
              {inviteSent && inviteCode && (
                <p className="flex items-center gap-1.5 text-xs text-success">
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Sent! Code: <span className="font-mono font-semibold">{inviteCode}</span>
                </p>
              )}
            </div>
          )}
        </section>

        {/* ─── Subscription ─────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Subscription</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={tierColor}>{tierLabel}</Badge>
              {billingCycle && currentAccount?.subscriptionTier !== "trial" && currentAccount?.subscriptionTier !== "starter" && (
                <span className="text-xs text-muted-foreground">
                  {billingCycle === "four_year" ? "4-Year" : billingCycle === "annual" ? "Annual" : "Monthly"}
                </span>
              )}
              {nextPayment && currentAccount?.subscriptionTier !== "trial" && currentAccount?.subscriptionTier !== "starter" && (
                <span className="text-xs text-muted-foreground">
                  · Renews {new Date(nextPayment).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
            <Link href="/settings/billing">
              <Button variant="outline" size="sm">Manage</Button>
            </Link>
          </div>
        </section>

        {/* ─── Legal ────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Legal</h2>
          <div className="space-y-1">
            {consentInfo.map((c) => (
              <div key={c.type} className="flex items-center justify-between py-1">
                <Link href={c.type === "terms_of_service" ? "/terms" : "/privacy"} target="_blank"
                  className="text-sm text-primary hover:underline">
                  {c.type === "terms_of_service" ? "Terms of Service" : "Privacy Policy"}
                  <span className="ml-1 text-xs text-muted-foreground">v{c.version}</span>
                </Link>
                <span className="text-xs text-muted-foreground">
                  Accepted {new Date(c.accepted_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Danger Zone ──────────────────────────────────────── */}
        <section className="border-t border-border pt-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Delete account</p>
              <p className="text-xs text-muted-foreground">Permanently remove your account and all data.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>
              Delete
            </Button>
          </div>
        </section>
      </div>

      {/* ─── Delete Confirmation Modal ──────────────────────────── */}
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
                      placeholder="DELETE" className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" />
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
    </div>
  );
}
