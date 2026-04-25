"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function PublicError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      icon={
        <svg
          aria-hidden="true"
          className="h-full w-full"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      }
      headline="Something went wrong"
      message="Something broke on our end. Try again, or head back home."
      actions={[
        { label: "Try again", onClick: reset },
        { label: "Back to home", href: "/" },
      ]}
    />
  );
}
