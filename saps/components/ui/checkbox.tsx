"use client";

import { type InputHTMLAttributes, type ReactNode } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  error?: string;
}

export function Checkbox({ label, error, className = "", id, ...props }: CheckboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          id={id}
          className={`mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            ${error ? "border-destructive" : ""}
            ${className}`}
          {...props}
        />
        {label && (
          <span className="text-sm text-foreground leading-relaxed">{label}</span>
        )}
      </label>
      {error && (
        <p className="ml-6.5 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
