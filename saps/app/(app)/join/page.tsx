"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  if (joining && !error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent>
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">Joining account...</p>
                <p className="mt-1 text-xs text-muted-foreground">Please wait while we connect you.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent>
              <div className="py-8 text-center" role="status">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-light">
                  <svg aria-hidden="true" className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">You&apos;re in!</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  You&apos;ve successfully joined the account. You can now view and manage the student&apos;s course plans.
                </p>
                <Button className="mt-6 w-full" onClick={() => router.push("/dashboard")}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Join Account</h2>
            <p className="text-sm text-muted-foreground">
              Enter your invite code to join a student&apos;s account.
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <div
                className="mb-4 rounded-lg border border-destructive/30 bg-destructive-light p-3 text-sm text-destructive"
                role="alert"
              >
                <span className="flex items-center gap-2">
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                    />
                  </svg>
                  {error}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <Input
                label="Account ID"
                type="text"
                value={accId}
                onChange={(e) => setAccId(e.target.value)}
                placeholder="Account ID from invite link"
              />
              <Input
                label="Invite Code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., AB12CD34"
                className="font-mono tracking-widest"
              />
              <Button
                className="mt-2 w-full"
                onClick={() => handleJoin(accId, code)}
                disabled={joining || !code || !accId}
              >
                {joining ? "Joining..." : "Join Account"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
