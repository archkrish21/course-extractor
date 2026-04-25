"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GsiInitConfig) => void;
          renderButton: (parent: HTMLElement, options: GsiButtonConfig) => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface GsiInitConfig {
  client_id: string;
  callback: (response: { credential: string }) => void;
  nonce?: string;
  use_fedcm_for_prompt?: boolean;
}

interface GsiButtonConfig {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number | string;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const buf = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

interface Props {
  onError?: (message: string) => void;
}

export function GoogleSignInButton({ onError }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const nonceRef = useRef<string | null>(null);

  const handleCredential = useCallback(
    async (response: { credential: string }) => {
      try {
        const { createBrowserClient } = await import("@supabase/ssr");
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
          nonce: nonceRef.current ?? undefined,
        });
        if (error) {
          onError?.("Google sign-in failed. Please try again.");
          return;
        }
        const redirectTo = searchParams.get("redirect");
        const provisionRes = await fetch("/api/v1/auth/google-provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ redirect: redirectTo ?? null }),
        });
        const provisionJson = await provisionRes.json();
        const next = provisionJson?.data?.next ?? redirectTo ?? "/dashboard";
        router.push(next);
        router.refresh();
      } catch {
        onError?.("Google sign-in failed. Please try again.");
      }
    },
    [onError, router, searchParams]
  );

  useEffect(() => {
    if (!scriptLoaded || !buttonRef.current || !GOOGLE_CLIENT_ID || !window.google) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const { raw, hashed } = await generateNonce();
      if (cancelled || !buttonRef.current || !window.google) return;
      nonceRef.current = raw;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
        nonce: hashed,
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 320,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [scriptLoaded, handleCredential]);

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div className="flex w-full justify-center">
        <div ref={buttonRef} />
      </div>
    </>
  );
}
