"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const PAGE_TITLES = {
  "/dashboard": "Inbox",
  "/conversations": "Conversations",
  "/script-builder": "Sales Script",
  "/playground": "Playground",
  "/billing": "Billing",
  "/settings": "Settings",
  "/calendar": "Calendar",
  "/analytics": "Analytics",
};

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function DashboardHeader() {
  const pathname = usePathname();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("users")
          .select("full_name, ai_mode")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      }
    });
  }, []);

  const title =
    PAGE_TITLES[pathname] ||
    PAGE_TITLES[Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k))] ||
    "Dashboard";

  const aiMode = profile?.ai_mode;

  return (
    <header className="h-16 bg-white border-b border-stone-200 px-6 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {aiMode === "active" && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            AI AGENT ACTIVE
          </div>
        )}
        {aiMode === "handoff" && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            HANDOFF MODE
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          <button className="w-10 h-10 flex items-center justify-center text-stone-500 hover:text-stone-900 transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#ff7e67] rounded-full ring-2 ring-white" />
          </button>
        </div>
        <div className="h-8 w-px bg-stone-200" />
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold">{profile?.full_name || "User"}</p>
            <p className="text-[11px] font-medium text-stone-500">Dashboard</p>
          </div>
          <Avatar className="h-10 w-10 rounded-xl border border-stone-200 shadow-sm">
            <AvatarFallback className="rounded-xl bg-stone-100 text-stone-600 text-sm">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
