"use client";

import { forwardRef, type InputHTMLAttributes, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  hideLabel?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, hideLabel = false, className = "", id: externalId, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const describedBy = [
      error ? errorId : null,
      helperText && !error ? helperId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={id}
          className={`text-sm font-medium text-foreground ${hideLabel ? "sr-only" : ""}`}
        >
          {label}
          {props.required && (
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={`
            h-11 min-h-[44px] w-full rounded-lg border px-3 text-sm
            transition-colors duration-150
            bg-background text-foreground
            placeholder:text-muted-foreground
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? "border-destructive" : "border-border hover:border-secondary"}
            ${className}
          `.trim()}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-sm text-destructive flex items-center gap-1" role="alert">
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
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
