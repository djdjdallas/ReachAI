"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { identifyUser } from "@/lib/analytics-identify";

// Mounted once in the root layout. Identifies every signed-in session,
// whatever the auth method, by Supabase user id (see analytics-identify.js).
// Sign-out resets PostHog in signOutAndClearState.
export default function PostHogIdentify() {
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // INITIAL_SESSION covers an existing session on page load; SIGNED_IN
      // covers a fresh login or signup in this tab.
      if (session?.user) identifyUser(posthog, session.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  return null;
}
