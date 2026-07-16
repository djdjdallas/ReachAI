"use client";

import Link from "next/link";
import { Instagram } from "lucide-react";

/**
 * Compact pill showing WHICH Instagram account the agent is wired to.
 * Rendered once in the dashboard header, adjacent to the agent-status pill,
 * so every dashboard page answers "which account is my agent running on?"
 * at a glance.
 *
 * Reads only the users row the header already fetched — no extra requests,
 * and never the connection-health endpoint (that hits Meta; settings-only).
 *
 * States:
 * - connected:        neutral ink pill, `@{handle}`
 * - reconnect needed: coral warning pill linking to settings
 * - not connected:    coral warning pill linking to settings
 */
export default function ConnectedAccountBadge({ profile }) {
  if (!profile) return null;

  const connected = !!profile.instagram_business_account_id;
  const handle = profile.instagram_username
    ? `@${profile.instagram_username}`
    : connected
      ? `Account ${profile.instagram_business_account_id}`
      : null;

  if (!connected) {
    return (
      <Link
        href="/settings"
        className="flex items-center gap-1.5 px-3 py-1 rounded-3xl bg-[#fff5f2] text-[#ff7e67] text-xs font-bold hover:bg-[#ffece7] transition-colors"
      >
        <Instagram className="h-3 w-3 flex-shrink-0" />
        No Instagram connected
      </Link>
    );
  }

  if (profile.meta_reconnect_required) {
    return (
      <Link
        href="/settings"
        className="flex items-center gap-1.5 px-3 py-1 rounded-3xl bg-[#fff5f2] text-[#ff7e67] text-xs font-bold hover:bg-[#ffece7] transition-colors"
      >
        <Instagram className="h-3 w-3 flex-shrink-0" />
        {handle} · reconnect needed
      </Link>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 rounded-3xl border border-[#e7e5e4] text-[#1c1917] text-xs font-bold"
      title="Connected Instagram account"
    >
      <Instagram className="h-3 w-3 flex-shrink-0 text-stone-400" />
      {handle}
    </div>
  );
}
