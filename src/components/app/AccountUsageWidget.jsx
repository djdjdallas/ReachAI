"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AccountUsageWidget() {
  const [usage, setUsage] = useState({ current: 0, limit: 500, percent: 0 });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("users")
          .select("dm_count_this_month, plan")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              const current = data.dm_count_this_month || 0;
              const limit = data.plan === "unlimited" ? null : 500;
              const percent = limit ? Math.min(Math.round((current / limit) * 100), 100) : 0;
              setUsage({ current, limit, percent });
            }
          });
      }
    });
  }, []);

  if (!usage.limit) return null;

  return (
    <div className="bg-stone-900 rounded-2xl p-4 text-white relative overflow-hidden">
      <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
      <p className="text-xs font-medium text-stone-400 mb-2">Account Usage</p>
      <div className="flex justify-between items-end mb-1">
        <span className="text-lg font-bold tracking-tight">
          {usage.current} / {usage.limit}
        </span>
        <span className="text-[10px] text-stone-400">{usage.percent}%</span>
      </div>
      <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#ff7e67] transition-all"
          style={{ width: `${usage.percent}%` }}
        />
      </div>
      <Link
        href="/billing"
        className="mt-4 w-full py-2 bg-white text-stone-900 rounded-xl text-xs font-bold hover:bg-stone-100 transition-all flex items-center justify-center"
      >
        Upgrade Plan
      </Link>
    </div>
  );
}
