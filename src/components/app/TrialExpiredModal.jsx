"use client";

import { useState } from "react";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { signOutAndClearState } from "@/lib/sign-out";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { chargeTodayText } from "@/lib/checkout-trial";

// This modal always checks out the Base plan. Keep in sync with
// PLANS.base.price in src/lib/stripe.js (server-only module).
const BASE_PRICE_CENTS = 9700;

// Hard-block modal shown when the user's trial has expired and they have
// no active subscription. Non-dismissible by intent — closing the dialog
// would leave the dashboard usable behind it. The only ways out are
// "Upgrade" (Stripe checkout) or "Sign out" (escape hatch so they can
// switch accounts without being trapped).
export default function TrialExpiredModal() {
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "base" }),
      });
      const data = await res.json();
      if (data.url) {
        posthog.capture("checkout_started", {
          plan_id: "base",
          source: "trial_expired_modal",
        });
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Trial-expired upgrade failed:", err);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutAndClearState();
    window.location.href = "/login";
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      {/* `onOpenChange` is a no-op so backdrop clicks and the built-in X
          can't dismiss this modal. Tailwind utility hides the X button
          (the only direct child <button> rendered by DialogContent). */}
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
            <Lock className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle>Your free trial has ended</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Subscribe to keep your AI agent active and continue replying to
            your Instagram DMs. Your conversations and settings are saved,
            so you can pick up right where you left off.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handleUpgrade}
            disabled={checkoutLoading}
            className="gap-1.5 bg-[#ff7e67] hover:bg-[#ff7e67]/90 text-white"
          >
            {checkoutLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Upgrade now
          </Button>
          {/* The trial is over by definition here, so checkout charges
              immediately. Say so before the click (create-checkout puts the
              same line on the Stripe page). */}
          <p className="text-xs text-stone-500 text-center">
            {chargeTodayText(BASE_PRICE_CENTS)}
          </p>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="text-stone-500 hover:text-stone-700"
          >
            Sign out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
