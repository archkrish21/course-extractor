/**
 * Email templates for SAPS.
 */

export function inviteEmail(params: {
  inviterName: string;
  studentName: string;
  role: string;
  inviteCode: string;
  claimUrl: string;
}): { subject: string; html: string } {
  const { inviterName, studentName, role, inviteCode, claimUrl } = params;

  return {
    subject: `You're invited to join ${studentName}'s SAPS account`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: bold; color: #111; margin-bottom: 8px;">
          You're invited! 🎓
        </h1>
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          <strong>${inviterName}</strong> has invited you to join <strong>${studentName}'s</strong>
          academic planning account on SAPS as a <strong>${role}</strong>.
        </p>

        <div style="margin: 24px 0; padding: 20px; background: #f7f7f7; border-radius: 12px; text-align: center;">
          <p style="font-size: 14px; color: #888; margin: 0 0 8px;">Your invite code</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111; margin: 0;">
            ${inviteCode}
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${claimUrl}"
             style="display: inline-block; padding: 12px 32px; background: #2563eb; color: white;
                    font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">
            Join Account
          </a>
        </div>

        <p style="font-size: 14px; color: #888; line-height: 1.5;">
          ${role === "student"
            ? `As the student, you'll be able to manage your course plans, track grades and GPA, and monitor graduation progress.`
            : `As a ${role}, you'll be able to view ${studentName}'s course plans, graduation progress, and academic records.${role === "parent" || role === "guardian" ? " You can also create plan suggestions for them to consider." : ""}`
          }
        </p>

        <p style="font-size: 14px; color: #888; line-height: 1.5;">
          Click the button above to create your account and join. If you already have an account,
          <a href="${claimUrl.replace('/signup?', '/join?code=').replace('&role=' + role, '')}" style="color: #2563eb;">click here to join directly</a>.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

        <p style="font-size: 12px; color: #aaa;">
          This invite expires in 7 days. If you didn't expect this email, you can safely ignore it.
        </p>
        <p style="font-size: 12px; color: #aaa;">
          SAPS — Student Academic Planning System
        </p>
      </div>
    `,
  };
}
