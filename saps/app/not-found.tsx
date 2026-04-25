import { ErrorState } from "@/components/ui/error-state";
import { getAuthenticatedUser } from "@/lib/auth/get-user";

export default async function NotFound() {
  const user = await getAuthenticatedUser();
  const href = user ? "/dashboard" : "/";
  const label = user ? "Back to dashboard" : "Back to home";

  return (
    <ErrorState
      numeral="404"
      headline="Page not found"
      message="Even genies lose track sometimes. That page doesn&rsquo;t exist or has moved."
      actions={[{ label, href }]}
      fullScreen
    />
  );
}
