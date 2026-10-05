import { describe, it, expect } from "vitest";
import {
  MESSAGING_WINDOW_MS,
  isWithinMessagingWindow,
  assertWithinMessagingWindow,
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
