"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PowerOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { shouldShowAiInactiveBanner } from "@/lib/onboarding";

// Persistent (non-dismissible) banner shown when Instagram is connected, the
// subscription is one the reply gates serve, and the AI is in handoff or off
// mode, so inbound DMs are saved but never answered. A paying customer spent their whole subscription in this state
// without noticing (8 of 11 threads skipped as ai_inactive), so this is
// deliberately not dismissible: it disappears only when the AI is on.
//
// Re-reads the profile on every route change, so switching modes from the
// conversations or settings page is reflected on the next navigation.
export default function AiInactiveBanner() {
  const pathname = usePathname();
  const [profile, setProfile] = useState(null);
  const [hasAccess, setHasAccess] = useState(null);
  const [turningOn, setTurningOn] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      supabase
        .from("users")
        .select("ai_mode, instagram_business_account_id")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (!cancelled && data) setProfile(data);
        });
    });
    fetch("/api/billing/access")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setHasAccess(!!data.hasAccess);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const turnOn = async () => {
    setError(null);
    setTurningOn(true);
    try {
      const res = await fetch("/api/users/ai-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "active" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't turn the AI on. Try again.");
        return;
      }
      setProfile((prev) => ({ ...prev, ai_mode: "active" }));
    } catch {
      setError("Couldn't turn the AI on. Try again.");
    } finally {
      setTurningOn(false);
    }
  };

  if (!shouldShowAiInactiveBanner(profile, hasAccess)) return null;

  return (
    <div className="sticky top-0 z-30 bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center gap-3">
      <PowerOff className="h-4 w-4 text-red-700 shrink-0" />
      <p className="text-xs text-red-900 leading-relaxed flex-1">
        <span className="font-bold">Your AI isn&apos;t replying to leads right now.</span>
        {error && <span className="ml-2 text-red-700">{error}</span>}
      </p>
      <button
        onClick={turnOn}
        disabled={turningOn}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#ff7e67] px-3 py-1 text-xs font-bold text-white hover:bg-[#ff6a50] disabled:opacity-60"
      >
        {turningOn && <Loader2 className="h-3 w-3 animate-spin" />}
        Turn it on
      </button>
    </div>
  );
}
