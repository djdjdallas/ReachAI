"use client";

import { useEffect } from "react";

// Supabase Dashboard "Send password recovery" links use the project's Site URL
// (the marketing homepage) instead of a dedicated reset path. The recovery
// access_token arrives in the URL fragment, which only the browser can read.
// This component forwards any such fragment to /update-password (the existing
// reset page) so the recovery token is processed by the right handler.
export default function RecoveryRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      window.location.replace("/update-password" + hash);
    }
  }, []);

  return null;
}
