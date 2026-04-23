"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSending(true);
    try {
      await apiFetch("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined, page: pathname }),
      });
      setSent(true);
      setTimeout(() => { setOpen(false); setSent(false); setRating(0); setComment(""); }, 2000);
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-40 flex h-12 items-center gap-2 rounded-full bg-primary pl-4 pr-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover hover:shadow-xl ${open ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}
        aria-label="Send feedback"
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
        Feedback
      </button>

      {/* Feedback panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => { if (!sending) { setOpen(false); } }} aria-hidden="true" />

          {/* Panel */}
          <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl border border-border bg-card shadow-2xl"
            role="dialog"
            aria-label="Send feedback"
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h3 className="text-sm font-semibold text-foreground">Send feedback</h3>
              <button type="button" onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Close feedback">
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {sent ? (
              /* Success state */
              <div className="px-5 py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
                  <svg aria-hidden="true" className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">Thanks for your feedback!</p>
                <p className="mt-1 text-xs text-muted-foreground">Your input helps us improve Genie.</p>
              </div>
            ) : (
              /* Form */
              <div className="px-5 py-4">
                {/* Rating */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground">How's your experience?</p>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="transition-transform hover:scale-110"
                        aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                      >
                        <svg
                          className={`h-8 w-8 transition-colors ${
                            star <= (hoveredRating || rating)
                              ? "fill-warning text-warning"
                              : "fill-none text-border"
                          }`}
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 h-4 text-xs text-muted-foreground">
                    {rating === 1 && "Poor"}
                    {rating === 2 && "Fair"}
                    {rating === 3 && "Good"}
                    {rating === 4 && "Great"}
                    {rating === 5 && "Excellent!"}
                  </p>
                </div>

                {/* Comment */}
                <div className="mt-3">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us more (optional)..."
                    rows={3}
                    aria-label="Feedback"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring resize-none"
                    maxLength={2000}
                  />
                </div>

                {/* Submit */}
                <Button size="sm" className="mt-3 w-full" onClick={handleSubmit} disabled={rating === 0 || sending}>
                  {sending ? "Sending..." : "Submit feedback"}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
