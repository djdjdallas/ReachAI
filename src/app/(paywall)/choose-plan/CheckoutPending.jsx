"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

// After Stripe Checkout. Returning here does NOT grant access: the Stripe
// webhook does, usually within seconds. This waits for the server's access
// decision, then moves on (middleware routes to onboarding or dashboard).
const POLL_MS = 2000;
const GIVE_UP_MS = 90_000;

export default function CheckoutPending() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/billing/access", { cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        if (data?.hasAccess) {
          window.location.href = "/dashboard";
          return;
        }
      } catch {
        // keep polling
      }
      if (Date.now() - started > GIVE_UP_MS) setSlow(true);
      setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pt-24 text-center max-w-md mx-auto">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#ff7e67]" />
      <h1 className="mt-6 text-2xl font-black">Setting up your account</h1>
      <p className="mt-3 text-stone-600">
        Confirming your subscription with Stripe. This usually takes a few seconds.
      </p>
      {slow && (
        <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This is taking longer than usual. Leave this page open, or email{" "}
          <a href={SUPPORT_MAILTO} className="font-bold underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          and I&apos;ll sort it out.
        </p>
      )}
    </div>
  );
}
