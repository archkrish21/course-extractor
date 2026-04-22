/**
 * Email templates for SAPS.
 *
 * All templates use a shared layout matching the Supabase Auth email
 * design: blue header with SAPS branding, white card body, and a
 * consistent footer with app URL and context line.
 */

/** Escape user-supplied strings before interpolating into HTML. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://saps.vercel.app";

/** Shared email wrapper matching the Supabase Auth template design. */
function emailLayout(params: {
  title: string;
  heading: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  footer: string;
  contextLine: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title} - Plan with Genie</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #6B1F3D; padding: 32px 32px 24px; text-align: center;">
              <img src="${APP_URL}/favicon-96x96.png" alt="" width="48" height="48" style="display: block; margin: 0 auto 12px; border-radius: 8px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">Plan with Genie</h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #FCD34D;">Academic planning, granted.</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #18181b;">${params.heading}</h2>
              ${params.body}
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="${params.ctaUrl}" target="_blank" style="display: inline-block; padding: 12px 32px; background-color: #6B1F3D; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      ${params.ctaText}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
                ${params.footer}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 0 32px 24px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 16px 0 4px; font-size: 11px; color: #a1a1aa; text-align: center;">
                <a href="${APP_URL}" style="color: #a1a1aa; text-decoration: underline;">Plan with Genie</a> &mdash; Academic planning, granted.
              </p>
              <p style="margin: 0; font-size: 11px; color: #a1a1aa; text-align: center;">
                ${params.contextLine}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Invite email for a NEW user who doesn't have a SAPS account yet.
 * CTA links to the signup page with invite params pre-filled.
 */
export function newUserInviteEmail(params: {
  inviterName: string;
  studentName: string;
  role: string;
  claimUrl: string;
}): { subject: string; html: string } {
  const safeInviter = escapeHtml(params.inviterName);
  const safeStudent = escapeHtml(params.studentName);
  const safeRole = escapeHtml(params.role);

  const roleDescription =
    params.role === "student"
      ? "As the student, you&#39;ll be able to manage your course plans, track grades and GPA, and monitor graduation progress."
      : `As a ${safeRole}, you&#39;ll be able to view ${safeStudent}&#39;s course plans, graduation progress, and academic records.`;

  return {
    subject: `You're invited to join ${params.studentName}'s Plan with Genie account`,
    html: emailLayout({
      title: "You're Invited",
      heading: "You've been invited",
      body: `
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #52525b;">
                <strong>${safeInviter}</strong> has invited you to join <strong>${safeStudent}'s</strong>
                academic planning account on Plan with Genie as a <strong>${safeRole}</strong>.
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #52525b;">
                ${roleDescription}
              </p>`,
      ctaText: "Create account &amp; join",
      ctaUrl: params.claimUrl,
      footer: "This invite expires in 7 days. If you didn&#39;t expect this email, you can safely ignore it.",
      contextLine: "You received this because someone invited you to a Plan with Genie account.",
    }),
  };
}

/**
 * Invite email for an EXISTING user who already has a SAPS account.
 * CTA links to the /join page to accept the invite directly.
 */
export function existingUserInviteEmail(params: {
  inviterName: string;
  studentName: string;
  role: string;
  joinUrl: string;
}): { subject: string; html: string } {
  const safeInviter = escapeHtml(params.inviterName);
  const safeStudent = escapeHtml(params.studentName);
  const safeRole = escapeHtml(params.role);

  return {
    subject: `You're invited to join ${params.studentName}'s Plan with Genie account`,
    html: emailLayout({
      title: "You're Invited",
      heading: "You've been invited",
      body: `
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #52525b;">
                <strong>${safeInviter}</strong> has invited you to join <strong>${safeStudent}'s</strong>
                academic planning account as a <strong>${safeRole}</strong>.
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #52525b;">
                Click the button below to accept the invitation and join the account.
              </p>`,
      ctaText: "Join account",
      ctaUrl: params.joinUrl,
      footer: "This invite expires in 7 days. If you didn&#39;t expect this email, you can safely ignore it.",
      contextLine: "You received this because someone invited you to a Plan with Genie account.",
    }),
  };
}

/**
 * @deprecated Use newUserInviteEmail or existingUserInviteEmail instead.
 * Kept temporarily for backward compatibility with existing callers.
 */
export function inviteEmail(params: {
  inviterName: string;
  studentName: string;
  role: string;
  inviteCode: string;
  claimUrl: string;
}): { subject: string; html: string } {
  return newUserInviteEmail(params);
}
