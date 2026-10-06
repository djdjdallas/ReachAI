import { describe, it, expect } from "vitest";
import {
  MESSAGING_WINDOW_MS,
  isWithinMessagingWindow,
  assertWithinMessagingWindow,
  inboundAtMs,
  MessagingWindowClosedError,
  WINDOW_CLOSED_MESSAGE,
} from "./messaging-window";

const NOW = Date.parse("2026-10-05T12:00:00Z");
const H = 60 * 60 * 1000;

describe("messaging window", () => {
  it("is 24 hours", () => {
    expect(MESSAGING_WINDOW_MS).toBe(24 * H);
  });

  it("open inside 24h of the lead's last message", () => {
    expect(isWithinMessagingWindow(new Date(NOW - 23 * H), NOW)).toBe(true);
    expect(isWithinMessagingWindow(NOW - 1000, NOW)).toBe(true);
    expect(isWithinMessagingWindow(new Date(NOW - H).toISOString(), NOW)).toBe(true);
  });

  it("closed at and after 24h", () => {
    expect(isWithinMessagingWindow(NOW - 24 * H, NOW)).toBe(false);
    expect(isWithinMessagingWindow(NOW - 25 * H, NOW)).toBe(false);
  });

  it("fails closed without a usable time (lead never messaged, or caller forgot)", () => {
    expect(isWithinMessagingWindow(undefined, NOW)).toBe(false);
    expect(isWithinMessagingWindow(null, NOW)).toBe(false);
    expect(isWithinMessagingWindow("not a date", NOW)).toBe(false);
  });

  it("assert throws a coded error when closed", () => {
    expect(() => assertWithinMessagingWindow(NOW - 25 * H, NOW)).toThrow(MessagingWindowClosedError);
    try {
      assertWithinMessagingWindow(null, NOW);
    } catch (err) {
      expect(err.code).toBe("messaging_window_closed");
    }
    expect(() => assertWithinMessagingWindow(NOW - H, NOW)).not.toThrow();
  });

  it("uses the agreed dashboard copy", () => {
    expect(WINDOW_CLOSED_MESSAGE).toBe("Reply window closed. Reply from the Instagram app.");
  });
});

describe("inboundAtMs (audit LM1: window measured from min(event timestamp, now))", () => {
  const NOW = Date.parse("2026-10-06T12:00:00Z");

  it("a late delivery is measured from when the lead sent it", () => {
    const sent = NOW - MESSAGING_WINDOW_MS - 60_000; // sent 24h01m ago, delivered now
    expect(inboundAtMs(sent, NOW)).toBe(sent);
    expect(isWithinMessagingWindow(inboundAtMs(sent, NOW), NOW)).toBe(false);
  });

  it("a future event timestamp can't stretch the window", () => {
    expect(inboundAtMs(NOW + 3_600_000, NOW)).toBe(NOW);
  });

  it("seconds are scaled; missing or junk falls back to receipt", () => {
    expect(inboundAtMs(Math.floor((NOW - 5000) / 1000), NOW)).toBe(NOW - 5000);
    for (const bad of [undefined, null, "", "abc", 0, -5]) expect(inboundAtMs(bad, NOW)).toBe(NOW);
  });
});
