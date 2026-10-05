import { describe, it, expect } from "vitest";
import {
  resolveOnboardingAiMode,
  shouldShowAiInactiveBanner,
  autoImportPending,
  mergeKeepingSaved,
  fillIfEmpty,
} from "./onboarding";

describe("resolveOnboardingAiMode", () => {
  it("arms the AI when the user wants it and a greeting exists", () => {
    expect(resolveOnboardingAiMode({ wantsActive: true, scriptReady: true })).toBe("active");
  });

  it("never writes 'active' without a greeting, even from the Go Live CTA", () => {
    // The default-ON toggle used to finish onboarding as 'active' here while
    // the webhook skipped every reply for the missing greeting.
    expect(resolveOnboardingAiMode({ wantsActive: true, scriptReady: false })).toBe("handoff");
  });

  it("respects an explicit OFF", () => {
    expect(resolveOnboardingAiMode({ wantsActive: false, scriptReady: true })).toBe("handoff");
  });
});

describe("shouldShowAiInactiveBanner", () => {
  const base = { instagram_business_account_id: "1789", ai_mode: "handoff" };

  it.each(["active", "trialing", "past_due"])(
    "shows for a %s subscription with the AI off",
    (subscription_status) => {
      expect(shouldShowAiInactiveBanner({ ...base, subscription_status })).toBe(true);
    }
  );

  it.each(["canceled", "expired", null])(
    "hides for a %s subscription, where turning it on would do nothing",
    (subscription_status) => {
      expect(
        shouldShowAiInactiveBanner({ ...base, ai_mode: "off", subscription_status })
      ).toBe(false);
    }
  );

  it("hides when the AI is already active", () => {
    expect(
      shouldShowAiInactiveBanner({ ...base, ai_mode: "active", subscription_status: "active" })
    ).toBe(false);
  });

  it("hides without a connected Instagram account or before the profile loads", () => {
    expect(
      shouldShowAiInactiveBanner({ ai_mode: "off", subscription_status: "active" })
    ).toBe(false);
    expect(shouldShowAiInactiveBanner(null)).toBe(false);
  });
});

describe("autoImportPending", () => {
  const NOW = Date.parse("2026-10-05T12:00:00Z");
  const connected = { instagram_business_account_id: "1789" };

  it("waits while the import is running (attempted, not finished)", () => {
    expect(
      autoImportPending({ ...connected, instagram_auto_import_attempted_at: "2026-10-05T11:59:58Z" }, NOW)
    ).toBe(true);
  });

  it("waits when the callback hasn't started it yet", () => {
    expect(autoImportPending(connected, NOW)).toBe(true);
  });

  it("stops once it finished (the old poll stopped at the START)", () => {
    expect(
      autoImportPending(
        {
          ...connected,
          instagram_auto_import_attempted_at: "2026-10-05T11:59:50Z",
          instagram_auto_import_finished_at: "2026-10-05T11:59:56Z",
        },
        NOW
      )
    ).toBe(false);
  });

  it("stops once a voice profile is ready", () => {
    expect(autoImportPending({ ...connected, voice_profile: { status: "ready" } }, NOW)).toBe(false);
  });

  it("doesn't wait on a stale attempt (dead run, or before the finished column existed)", () => {
    expect(
      autoImportPending({ ...connected, instagram_auto_import_attempted_at: "2026-09-07T13:59:57Z" }, NOW)
    ).toBe(false);
  });

  it("never waits without Instagram connected", () => {
    expect(autoImportPending({}, NOW)).toBe(false);
  });
});

describe("mergeKeepingSaved", () => {
  it("a blank form field never erases what the import saved", () => {
    const saved = { offer: "12-week strength program", greeting: "Hey! What made you reach out?" };
    expect(mergeKeepingSaved(saved, { offer: "", greeting: "" })).toEqual(saved);
  });

  it("typed values win", () => {
    expect(mergeKeepingSaved({ offer: "old" }, { offer: "new" })).toEqual({ offer: "new" });
  });

  it("keeps saved keys the form doesn't know about", () => {
    expect(mergeKeepingSaved({ custom: 1 }, { tone: "casual" })).toEqual({ custom: 1, tone: "casual" });
  });

  it("writes non-string preferences as-is", () => {
    expect(mergeKeepingSaved({ human_in_loop: true }, { human_in_loop: false }).human_in_loop).toBe(false);
  });

  it("handles a missing base", () => {
    expect(mergeKeepingSaved(null, { offer: "x" })).toEqual({ offer: "x" });
  });
});

describe("fillIfEmpty", () => {
  it("fills an empty field with the imported value", () => {
    expect(fillIfEmpty("", "Imported offer")).toBe("Imported offer");
  });
  it("never overwrites what the coach typed while it ran", () => {
    expect(fillIfEmpty("My offer", "Imported offer")).toBe("My offer");
  });
  it("leaves the field alone when nothing was imported", () => {
    expect(fillIfEmpty("", null)).toBe("");
  });
});
