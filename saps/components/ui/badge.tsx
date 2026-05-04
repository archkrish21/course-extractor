import type { HTMLAttributes } from "react";

type BadgeVariant =
  | "default"
  | "ap"
  | "honors"
  | "dual-credit"
  | "accelerated"
  | "success"
  | "info"
  | "warning"
  | "destructive";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-muted text-muted-foreground",
  ap: "bg-ap-light text-ap",
  honors: "bg-honors-light text-honors",
  "dual-credit": "bg-dual-credit-light text-dual-credit",
  accelerated: "bg-accelerated-light text-accelerated",
  success: "bg-success-light text-success",
  info: "bg-info-light text-info",
  warning: "bg-warning-light text-warning",
  destructive: "bg-destructive-light text-destructive",
};

function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
        text-xs font-semibold whitespace-nowrap
        ${variantClasses[variant]}
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeProps, BadgeVariant };
