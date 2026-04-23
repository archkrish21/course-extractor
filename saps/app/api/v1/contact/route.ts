import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rateLimit } from "@/lib/api/rate-limit";
import { sendEmail } from "@/lib/email/client";

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  subject: z.string().max(200).optional(),
  message: z.string().min(1).max(5000),
});

const NOTIFY_EMAIL = "planwithgenie@gmail.com";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * POST /api/v1/contact
 * Store a contact message (no auth required).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip") ?? "unknown";
    const rl = await rateLimit(`contact:${ip}`, 5, 60);
    if (!rl.success) {
      return errorResponse("RATE_LIMITED", "Too many requests.", 429);
    }

    const body = await request.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request.", 400);
    }

    const { name, email, subject, message } = parsed.data;

    await db.execute(
      sql`INSERT INTO contact_messages (name, email, subject, message, created_at)
          VALUES (${name}, ${email}, ${subject ?? null}, ${message}, NOW())`
    );

    const messageHtml = escapeHtml(message).replace(/\n/g, "<br>");
    await sendEmail({
      to: NOTIFY_EMAIL,
      replyTo: email,
      subject: `[Contact] ${subject || "New message"} — from ${name}`,
      html: `
        <h2 style="margin:0 0 16px">New contact form submission</h2>
        <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
        <p><strong>Subject:</strong> ${subject ? escapeHtml(subject) : "(none)"}</p>
        <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0" />
        <p style="white-space:pre-wrap">${messageHtml}</p>
        <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0" />
        <p style="color:#6b7280;font-size:12px">Reply directly to this email to respond to ${escapeHtml(name)}.</p>
      `,
    });

    return successResponse({ received: true }, undefined, 201);
  } catch (error) {
    console.log("[contact] Error (non-fatal):", error);
    return successResponse({ received: true }, undefined, 201);
  }
}
