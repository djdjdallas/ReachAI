import { NextResponse } from "next/server";

/**
 * Shared cron authorization for Vercel cron routes.
 *
 * Fails CLOSED: if CRON_SECRET is unset the comparison would otherwise become
 * `Bearer undefined`, which a caller could trivially guess — so a missing
 * secret is treated as a hard 401, never an open door. Mirrors the fail-closed
 * behavior already used by /api/drip/enroll.
 *
 * Usage:
 *   const denied = assertCron(request);
 *   if (denied) return denied;
 *
 * @param {Request} request
 * @returns {NextResponse|null} a 401 response when unauthorized, else null
 */
export function assertCron(request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
