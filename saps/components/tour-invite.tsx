"use client";

import { useEffect } from "react";

interface TourInviteProps {
  visible: boolean;
  title: string;
  description: string;
  onStart: () => void;
  onSkip: () => void;
}

/**
 * Consent card for guided tours. Sits above the FeedbackWidget bottom-right
 * so they stack rather than overlap. Esc dismisses (treats as Skip).
 */
export function TourInvite({ visible, title, description, onStart, onSkip }: TourInviteProps) {
  useEffect(() => {
    if (!visible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [visible, onSkip]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Guided tour invitation"
      className="fixed bottom-24 right-4 left-4 z-30 rounded-2xl border border-border bg-card p-5 shadow-2xl sm:left-auto sm:right-6 sm:w-80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="-mt-1 -mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss tour invitation"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onStart}
          className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Start tour
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
