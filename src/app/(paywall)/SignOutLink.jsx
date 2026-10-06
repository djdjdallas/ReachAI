"use client";

import { useState } from "react";
import { signOutAndClearState } from "@/lib/sign-out";

export default function SignOutLink() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOutAndClearState();
        window.location.href = "/login";
      }}
      className="text-sm font-bold text-stone-500 hover:text-stone-900 disabled:opacity-50"
    >
      Sign out
    </button>
  );
}
