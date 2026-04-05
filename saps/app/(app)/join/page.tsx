"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

export default function JoinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const inviteCode = searchParams.get("code") ?? searchParams.get("invite") ?? "";
  const accountId = searchParams.get("account") ?? "";

  const [code, setCode] = useState(inviteCode);
  const [accId, setAccId] = useState(accountId);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auto-join if both params are present
  useEffect(() => {
    if (inviteCode && accountId && !success) {
      handleJoin(accountId, inviteCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleJoin(aid: string, icode: string) {
    if (!aid || !icode) {
      setError("Account ID and invite code are required.");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/accounts/${aid}/members/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: icode }),
      });
      if (res.ok) {
        // Switch to the joined/created account so it becomes the active one
        const json = await res.json();
        const joinedId = json?.data?.account_id ?? aid;
        if (typeof window !== "undefined") {
          localStorage.setItem("saps_current_account_id", joinedId);
        }
        setSuccess(true);
      } else {
        const json = await res.json();
        setError(json?.error?.message ?? `Failed to join (${res.status}).`);
      }
    } catch {
      setError("Failed to join account.");
    } finally {
      setJoining(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md py-12">
        <Card>
          <CardContent>
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
                <svg aria-hidden="true" className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-foreground">You're in! 🎉</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You've successfully joined the account. You can now view and manage the student's course plans.
              </p>
              <Button className="mt-4" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold text-foreground">Join Account</h2>
          <p className="text-sm text-muted-foreground">
            Enter your invite code to join a student's account.
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Account ID</label>
              <input
                type="text"
                value={accId}
                onChange={(e) => setAccId(e.target.value)}
                placeholder="Account ID from invite link"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Invite Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., AB12CD34"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-mono tracking-widest"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => handleJoin(accId, code)}
              disabled={joining || !code || !accId}
            >
              {joining ? "Joining..." : "Join Account"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
