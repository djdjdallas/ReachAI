// Shared fixture for the late-Meta-delivery regression (audit LM1
// follow-up): a lead message SENT 30 hours ago that Meta delivers now.
// The Instagram webhook test asserts the webhook stores exactly
// `storedCreatedAt` on the inbound row; the dashboard reply and drip tests
// read that same value back as the lead's last message. One definition, so
// the three tests can't drift apart.
import { inboundAtMs } from "./messaging-window";

export const LATE_HOURS = 30;

export function lateDelivery(now = Date.now()) {
  const sentAtMs = now - LATE_HOURS * 3_600_000;
  return {
    sentAtMs,
    receivedAtMs: now,
    storedCreatedAt: new Date(inboundAtMs(sentAtMs, now)).toISOString(),
  };
}
