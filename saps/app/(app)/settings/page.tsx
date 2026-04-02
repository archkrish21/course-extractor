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
  const [generating, setGenerating] = useState(false);
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

  const handleGenerateInvite = async () => {
    if (!currentAccount?.id) return;
    setGenerating(true);
    try {
      const res = await apiFetch(`/api/v1/accounts/${currentAccount.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_role: inviteRole }),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data ?? json;
        setInviteCode(data.code ?? data.inviteCode ?? null);
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
              Generate an invite code to share with a parent, guardian, or counselor. The code expires in 7 days.
            </p>
            <div className="flex items-center gap-2">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="parent">Parent</option>
                <option value="guardian">Guardian</option>
                <option value="counselor">Counselor</option>
              </select>
              <Button onClick={handleGenerateInvite} disabled={generating}>
                {generating ? "Generating..." : "Generate Invite Code"}
              </Button>
            </div>

            {inviteCode && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm text-muted-foreground">Share this code with your {inviteRole}:</p>
                <p className="mt-1 text-2xl font-bold tracking-widest text-primary">{inviteCode}</p>
                <p className="mt-1 text-xs text-muted-foreground">They can use this at signup or on the claim page. Expires in 7 days.</p>
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
