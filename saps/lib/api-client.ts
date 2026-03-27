/**
 * Fetch wrapper that automatically attaches the current account ID header.
 *
 * Use this instead of raw `fetch` for any API call that should be scoped to the
 * currently-selected student account.
 */
export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const accountId =
    typeof window !== "undefined"
      ? localStorage.getItem("saps_current_account_id")
      : null;

  const headers = new Headers(options?.headers);
  if (accountId) {
    headers.set("X-Account-Id", accountId);
  }

  return fetch(url, { ...options, headers, credentials: "same-origin" });
}
