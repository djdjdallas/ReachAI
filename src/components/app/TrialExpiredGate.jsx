"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isFounder } from "@/lib/founder";
import TrialExpiredModal from "./TrialExpiredModal";

const SESSION_DISMISS_KEY = "clinchd:trial-warning-banner-dismissed";

// Decides — purely client-side from the user's profile — whether to show
// the hard-block expired modal or the soft 3-day-warning banner. Founder
// emails (FOUNDER_EMAILS) bypass both.
//
// State machine:
//   subscription_status === 'trialing' && trial_ends_at <= now      → expired
//   subscription_status === 'expired'                                → expired
//   subscription_status === 'trialing' && 0 < daysRemaining <= 3     → endingSoon
//   anything else                                                    → null
function computeTrialState(profile) {
  if (!profile) return { kind: "none" };
  const status = profile.subscription_status;
  const endsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const now = new Date();

  if (status === "expired") return { kind: "expired" };
  if (status === "trialing" && endsAt && endsAt <= now) {
    return { kind: "expired" };
  }
  if (status === "trialing" && endsAt && endsAt > now) {
    const msRemaining = endsAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 3) return { kind: "endingSoon", daysRemaining };
  }
  return { kind: "none" };
}

export default function TrialExpiredGate() {
  const [profile, setProfile] = useState(null);
  // Lazy init reads sessionStorage once on the client; safe because the
  // banner only renders after `profile` is set (post-auth, client-only).
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      // Founder bypass: don't even fetch the profile, nothing to render.
      if (isFounder(user.email)) return;
      supabase
        .from("users")
        .select("email, subscription_status, trial_ends_at")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setProfile({ ...data, _authEmail: user.email });
        });
    });
  }, []);

  const dismissBanner = () => {
    setBannerDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    }
  };

  if (!profile) return null;
  // Belt-and-suspenders: also check the persisted email in case auth and
  // profile rows ever diverge.
  if (isFounder(profile.email) || isFounder(profile._authEmail)) return null;

  const state = computeTrialState(profile);

  if (state.kind === "expired") {
    return <TrialExpiredModal />;
  }

  if (state.kind === "endingSoon" && !bannerDismissed) {
    const dayLabel = state.daysRemaining === 1 ? "day" : "days";
    return (
      <div className="sticky top-0 z-30 bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-3">
        <Clock className="h-4 w-4 text-amber-700 shrink-0" />
        <p className="text-xs text-amber-900 leading-relaxed flex-1">
          <span className="font-bold">
            Your free trial ends in {state.daysRemaining} {dayLabel}.
          </span>{" "}
          <Link
            href="/billing"
            className="underline font-bold text-amber-900 hover:text-amber-950"
          >
            Upgrade now →
          </Link>
        </p>
        <button
          onClick={dismissBanner}
          className="text-amber-700 hover:text-amber-900 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return null;
}
