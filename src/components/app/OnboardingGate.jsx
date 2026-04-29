"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X, Sparkles, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOnboardingState } from "@/lib/onboarding";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SESSION_DISMISS_KEY = "clinchd:onboarding-banner-dismissed";

export default function OnboardingGate() {
  const [profile, setProfile] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBannerDismissed(sessionStorage.getItem(SESSION_DISMISS_KEY) === "1");
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("users")
        .select(
          "script_config, instagram_business_account_id, has_seen_onboarding_modal"
        )
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          setProfile(data);

          const onboarding = getOnboardingState(data);
          // First-login modal: user has connected Instagram but their script
          // isn't complete, and we haven't shown the modal yet.
          if (
            !data.has_seen_onboarding_modal &&
            !onboarding.complete &&
            !onboarding.missing.instagram
          ) {
            setModalOpen(true);
          }
        });
    });
  }, []);

  const dismissBanner = () => {
    setBannerDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    }
  };

  const acknowledgeModal = async () => {
    setModalOpen(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("users")
        .update({ has_seen_onboarding_modal: true })
        .eq("id", user.id);
    }
  };

  if (!profile) return null;
  const onboarding = getOnboardingState(profile);
  if (onboarding.complete) return null;

  const message = onboarding.missing.instagram
    ? "Setup incomplete: connect your Instagram account so the AI can read and reply to DMs."
    : "Setup incomplete: your AI agent can't respond to DMs until you fill out your Sales Script.";
  const ctaHref = onboarding.missing.instagram ? "/settings" : "/script-builder";
  const ctaLabel = onboarding.missing.instagram
    ? "Connect Instagram"
    : "Complete Setup";

  return (
    <>
      {!bannerDismissed && (
        <div className="sticky top-0 z-30 bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
          <p className="text-xs text-amber-900 leading-relaxed flex-1">
            <span className="font-bold">⚠️ {message}</span>{" "}
            <Link
              href={ctaHref}
              className="underline font-bold text-amber-900 hover:text-amber-950"
            >
              {ctaLabel} →
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
      )}

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) acknowledgeModal();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-[#fff5f2] flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-[#ff7e67]" />
            </div>
            <DialogTitle>Welcome to Clinchd!</DialogTitle>
            <DialogDescription className="leading-relaxed">
              One last step: fill out your Sales Script so the AI knows your
              offer, customer, and objections. Without it, the AI can&apos;t
              respond to DMs.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={acknowledgeModal}
              className="text-stone-500"
            >
              Later
            </Button>
            <Button asChild onClick={acknowledgeModal}>
              <Link href="/script-builder" className="gap-1.5">
                Set up Sales Script
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
