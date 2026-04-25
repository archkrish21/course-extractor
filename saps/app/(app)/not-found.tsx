import { ErrorState } from "@/components/ui/error-state";

export default function AppNotFound() {
  return (
    <ErrorState
      numeral="404"
      headline="Page not found"
      message="Even genies lose track sometimes. That page doesn&rsquo;t exist or has moved."
      actions={[{ label: "Back to dashboard", href: "/dashboard" }]}
    />
  );
}
