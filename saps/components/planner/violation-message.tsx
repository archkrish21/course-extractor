"use client";

import { useState } from "react";
import type { MessageSegment } from "@/lib/planner/format-violation-message";

/**
 * Renders a violation message as name-primary text. Each course-name segment
 * is wrapped in a small popup that surfaces the underlying code(s) on
 * hover/focus.
 *
 * Uses React state (not CSS group-hover) for two reasons:
 *   1. The card popover renders this inside an overflow-y-auto <ul>, where
 *      a CSS-only opacity-0/group-hover:opacity-100 toggle leaves the
 *      absolutely-positioned tooltip in the DOM at all times — which (a)
 *      sometimes shows even off-hover and (b) can interfere with the
 *      parent's scroll-height calculation, hiding the scrollbar.
 *   2. Conditional rendering means the tooltip element only exists while
 *      the chip is actually focused/hovered.
 */
export function ViolationMessage({ segments }: { segments: MessageSegment[] }) {
  return (
    <span className="leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return <span key={i}>{seg.text}</span>;
        }
        return <NameWithCodeTooltip key={i} name={seg.name} codes={seg.codes} />;
      })}
    </span>
  );
}

function NameWithCodeTooltip({ name, codes }: { name: string; codes: string[] }) {
  const [open, setOpen] = useState(false);
  const hasCodes = codes.length > 0;
  const show = () => hasCodes && setOpen(true);
  const hide = () => setOpen(false);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span
        className="font-medium text-foreground cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2"
        tabIndex={hasCodes ? 0 : -1}
      >
        {name}
      </span>
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-50 mt-1 max-w-[14rem] break-words rounded-md bg-foreground px-2 py-1 text-[11px] font-mono text-background shadow-lg"
        >
          {codes.join(" / ")}
        </span>
      )}
    </span>
  );
}
