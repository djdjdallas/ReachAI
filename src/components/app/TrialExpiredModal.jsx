"use client";

import { useEffect, useState } from "react";
import { Lock, ArrowRight } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { countMissedLeads, missedLeadsText } from "@/lib/inactive-inbound";

// Hard-block modal for a user without access who still reaches a dashboard
// page (middleware normally sends them to /choose-plan first). Non-
// dismissible by intent. The ways out are "Choose a plan" (the plan page,
// which shows each plan's real offer from the server) or "Sign out". No
// prices here: they live in src/lib/plans.js and the plan page.
export default function TrialExpiredModal() {
  // Leads who messaged since the trial ended. This modal covers the
  // dashboard for expired users, so the count is shown here too.
  const [missedLeads, setMissedLeads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return;
      const n = await countMissedLeads(supabase, user.id);
      if (!cancelled) setMissedLeads(n);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
        {missedLeadsText(missedLeads, "expired") && (
          <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {missedLeadsText(missedLeads, "expired")}
          </p>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={() => {
              posthog.capture("choose_plan_opened", { source: "trial_expired_modal" });
              window.location.href = "/choose-plan";
            }}
            className="gap-1.5 bg-[#ff7e67] hover:bg-[#ff7e67]/90 text-white"
          >
            <ArrowRight className="h-4 w-4" />
            Choose a plan
          </Button>
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
