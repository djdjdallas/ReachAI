"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, X } from "lucide-react";
import TrialExpiredModal from "./TrialExpiredModal";

const SESSION_DISMISS_KEY = "clinchd:trial-warning-banner-dismissed";

// UX only. The access DECISION is the server's (GET /api/billing/access,
// backed by hasActiveAccess in src/lib/billing/access.js); middleware
// already sends users without access to /billing, and every send path
// refuses on its own. This shows:
//   - the hard-block modal if a no-access user still lands on a dashboard
//     page (not on /billing, which IS the paywall);
//   - the soft banner during the last 3 days of a legacy no-card trial.
// No founder email bypass: founder accounts are comped rows.
function computeTrialState(access, now = Date.now()) {
  if (!access) return { kind: "none" };
  if (!access.hasAccess) return { kind: "expired" };
  if (access.trialEndsAt) {
    const msRemaining = new Date(access.trialEndsAt).getTime() - now;
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    if (daysRemaining > 0 && daysRemaining <= 3) return { kind: "endingSoon", daysRemaining };
  }
  return { kind: "none" };
}

export default function TrialExpiredGate() {
  const pathname = usePathname();
  const [access, setAccess] = useState(null);
  // Lazy init reads sessionStorage once on the client; safe because the
  // banner only renders after `access` is set (post-auth, client-only).
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/access")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAccess(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const dismissBanner = () => {
    setBannerDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    }
  };

  if (!access) return null;

  const state = computeTrialState(access);

  // /billing is the paywall itself; the modal would cover the plan cards.
  if (state.kind === "expired" && !pathname?.startsWith("/billing")) {
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
