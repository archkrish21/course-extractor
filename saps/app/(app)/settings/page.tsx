"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAccount } from "@/lib/account-context";
import { apiFetch } from "@/lib/api-client";

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
  const { currentAccount } = useAccount();
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState("parent");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generating, setGenerating] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [loading, setLoading] = useState(true);

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
  }, [currentAccount]);

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

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Settings</h1>

      <div className="space-y-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">Account</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Student Name</span>
                <span className="text-sm font-medium text-foreground">{currentAccount?.studentName ?? "—"}</span>
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
          </CardContent>
        </Card>

        {/* Family Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Family Members</h2>
              <Badge className="bg-muted text-muted-foreground text-[10px]">{members.length} member{members.length !== 1 ? "s" : ""}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-10 rounded bg-muted" />
                <div className="h-10 rounded bg-muted" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {members.map((m) => (
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
                      </div>
                    </div>
                  ))}
                </div>

                {members.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No members yet. Invite a parent or guardian below.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Invite Member */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">Invite Family Member</h2>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Send an email invitation to a family member to join this account.
            </p>
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
          </CardContent>
        </Card>

        {/* Billing link */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">Billing & Subscription</h2>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Manage your subscription, view pricing, and update payment methods.
            </p>
            <Link href="/settings/billing">
              <Button variant="outline">Manage Billing</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
