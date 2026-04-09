interface SpinnerProps {
  className?: string;
  /** "border" uses a CSS border spinner, "svg" uses an SVG circle spinner. Default: "border". */
  variant?: "border" | "svg";
}

/**
 * Reusable loading spinner component.
 *
 * Border variant (default): renders a rounded div with a spinning border.
 * SVG variant: renders the classic circle + arc SVG spinner.
 */
export function Spinner({ className = "", variant = "border" }: SpinnerProps) {
  if (variant === "svg") {
    return (
      <svg
        className={`animate-spin ${className}`.trim()}
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );
  }

  return (
    <div
      className={`animate-spin rounded-full ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
