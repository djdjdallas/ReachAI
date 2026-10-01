import { describe, it, expect } from "vitest";
import {
  resolveOnboardingAiMode,
  shouldShowAiInactiveBanner,
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
