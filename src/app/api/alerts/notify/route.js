import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notifications";

/**
 * POST /api/alerts/notify
 *
 * Authenticated internal alert endpoint for external monitors (the scheduled
 * cloud "liveness" agents). Sends a plain alert email via Resend to the fixed
 * owner address. The recipient is NOT caller-controlled — a leaked token can at
 * worst send mail to the owner's own inbox — so this is intentionally low blast
 * radius. Fails closed if ALERT_TOKEN is unset.
 *
 * Body: { subject?: string, message: string }
 * Auth: Authorization: Bearer ${ALERT_TOKEN}
 */
export async function POST(request) {
  const token = process.env.ALERT_TOKEN;
  const auth = request.headers.get("authorization");
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subject =
    typeof payload?.subject === "string" && payload.subject.trim()
      ? payload.subject.trim().slice(0, 200)
      : "Monitor alert";
  const message =
    typeof payload?.message === "string" ? payload.message.slice(0, 20000) : "";
  if (!message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const to =
    process.env.ALERT_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "dominickjerell@gmail.com";

  const html = `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;white-space:pre-wrap;word-break:break-word;line-height:1.55;color:#1c1917;">${escapeHtml(
    message
  )}</pre>`;

  const result = await sendEmail({
    to,
    subject: `[Clinchd Monitor] ${subject}`,
    html,
  });

  if (!result.success) {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, messageId: result.messageId });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
