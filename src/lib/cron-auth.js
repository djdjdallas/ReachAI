import { timingSafeEqual } from "node:crypto";

// Shared cron auth. Fails CLOSED when CRON_SECRET is unset — the old
// template-string compare (`Bearer ${process.env.CRON_SECRET}`) matched the
// literal header "Bearer undefined" on a misconfigured deploy, letting an
// outsider trigger token refreshes and drip sends. Timing-safe compare, same
// semantics as the original drip-process implementation.
export function isAuthorizedCron(req) {
  if (!process.env.CRON_SECRET) return false;
  const auth = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  return auth.length === expected.length && timingSafeEqual(auth, expected);
}

// Internal server-to-server calls (the Stripe webhook calling
// /api/drip/enroll) send CRON_SECRET in x-internal-secret. Same rules:
// fails closed without the secret, constant-time compare (audit L8; the
// old `!==` compare leaked how much of the secret matched through timing).
export function isAuthorizedInternal(req) {
  if (!process.env.CRON_SECRET) return false;
  const provided = Buffer.from(req.headers.get("x-internal-secret") || "");
  const expected = Buffer.from(process.env.CRON_SECRET);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
