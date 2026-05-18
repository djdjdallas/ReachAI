"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  Inbox,
  Users,
  Calendar,
  BarChart3,
  FlaskConical,
  Cpu,
  Settings,
  LogOut,
  Menu,
  MessageSquare,
  Send,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import AccountUsageWidget from "@/components/app/AccountUsageWidget";

const mainNavLinks = [
  { href: "/dashboard", label: "Inbox", icon: Inbox, showBadge: true },
  { href: "/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/native-send", label: "Native Send", icon: Send },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const settingsNavLinks = [
  { href: "/script-builder", label: "Sales Script", icon: Cpu },
  { href: "/playground", label: "Playground", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ pathname, onSignOut, conversationCount, onLinkClick }) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Logo */}
      <div className="h-20 flex items-center px-6 gap-2.5">
        <div className="w-8 h-8 bg-[#ff7e67] rounded-lg flex items-center justify-center shadow-lg shadow-[#ff7e67]/20">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-xl font-extrabold tracking-tight">Clinchd</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {mainNavLinks.map(({ href, label, icon: Icon, showBadge }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive
                  ? "bg-[#fff5f2] text-[#ff7e67] font-semibold"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-900 font-medium"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
              {showBadge && conversationCount > 0 && (
                <span className="ml-auto bg-[#ff7e67] text-white text-[10px] px-2 py-0.5 rounded-full">
                  {conversationCount}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-4 pb-2 px-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
          Settings
        </div>

        {settingsNavLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive
                  ? "bg-[#fff5f2] text-[#ff7e67] font-semibold"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-900 font-medium"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-stone-100 space-y-3">
        <AccountUsageWidget />
        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-stone-400 hover:text-stone-600 text-xs font-medium transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [conversationCount, setConversationCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("status", ["qualifying", "interested"])
          .then(({ count }) => {
            if (count != null) setConversationCount(count);
          });
      }
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 hidden md:block border-r border-stone-200">
        <SidebarContent
          pathname={pathname}
          onSignOut={handleSignOut}
          conversationCount={conversationCount}
        />
      </aside>

      {/* Mobile hamburger + sheet */}
      <div className="fixed top-0 left-0 right-0 z-50 md:hidden flex items-center h-14 px-4 bg-white border-b border-stone-200">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-stone-900">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-white border-r border-stone-200">
            <SidebarContent
              pathname={pathname}
              onSignOut={handleSignOut}
              conversationCount={conversationCount}
              onLinkClick={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2 ml-2">
          <div className="w-7 h-7 bg-[#ff7e67] rounded-lg flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-base font-extrabold">Clinchd</span>
        </div>
      </div>
    </>
  );
}
