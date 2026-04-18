import { Resend } from "resend";

/**
 * Send an email via Resend. Returns true on success, false on failure.
 * Reads RESEND_API_KEY at call time (not module load time) to handle
 * Next.js hot reload and env var changes.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] Skipping email (RESEND_API_KEY not set):", params.subject, "→", params.to);
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: params.from ?? `Plan with Genie <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.error("[email] Resend error:", JSON.stringify(error));
      return false;
    }
    console.log("[email] Sent:", params.subject, "→", params.to);
    return true;
  } catch (error) {
    console.error("[email] Failed to send:", error);
    return false;
  }
}
