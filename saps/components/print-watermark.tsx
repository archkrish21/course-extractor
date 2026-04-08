/**
 * Watermark overlay for print views.
 * Uses .print-watermark CSS class which is hidden on screen and shown via @media print.
 * On dedicated print pages (e.g. /planner/print), pass `alwaysVisible` to show it on screen too.
 */
export function PrintWatermark({ alwaysVisible = false }: { alwaysVisible?: boolean }) {
  return (
    <div
      className={`print-watermark pointer-events-none fixed inset-0 z-50 ${alwaysVisible ? "flex" : "hidden"} items-center justify-center`}
      aria-hidden="true"
    >
      <p
        className="whitespace-nowrap text-[72px] font-bold uppercase tracking-widest text-foreground/[0.06]"
        style={{ transform: "rotate(-35deg)" }}
      >
        UNOFFICIAL &mdash; SAPS
      </p>
    </div>
  );
}
