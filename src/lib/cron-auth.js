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
