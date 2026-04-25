import { type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ErrorStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline";
}

interface ErrorStateProps {
  /** Large display string (e.g. "404"). Mutually exclusive with `icon`. */
  numeral?: string;
  /** Large display icon. Rendered at 30% opacity per DESIGN.md §10.5. */
  icon?: ReactNode;
  headline: string;
  message: string;
  actions: ErrorStateAction[];
  /** Use the full viewport height instead of the default 60vh. */
  fullScreen?: boolean;
}

const linkClasses = {
  default:
    "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  outline:
    "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-transparent px-8 text-base font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
} as const;

export function ErrorState({
  numeral,
  icon,
  headline,
  message,
  actions,
  fullScreen = false,
}: ErrorStateProps) {
  return (
    <div
      className={`flex ${
        fullScreen ? "min-h-screen" : "min-h-[60vh]"
      } flex-col items-center justify-center px-4 py-16 text-center`}
    >
      <div className="flex w-full max-w-md flex-col items-center">
        {numeral && (
          <p className="text-[8rem] font-bold leading-none tracking-tight text-foreground-muted/30 sm:text-[10rem]">
            {numeral}
          </p>
        )}
        {icon && (
          <div className="flex h-24 w-24 items-center justify-center text-foreground-muted/30">
            {icon}
          </div>
        )}
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {headline}
        </h1>
        <p className="mt-3 text-foreground-muted">{message}</p>
        {actions.length > 0 && (
          <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
            {actions.map((action, i) => {
              const variant = action.variant ?? (i === 0 ? "default" : "outline");
              if (action.href) {
                return (
                  <Link key={i} href={action.href} className={linkClasses[variant]}>
                    {action.label}
                  </Link>
                );
              }
              return (
                <Button
                  key={i}
                  variant={variant}
                  size="lg"
                  onClick={action.onClick}
                  className="w-full sm:w-auto"
                >
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
