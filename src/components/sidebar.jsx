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
  MessageCircleReply,
  Mic,
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
  {
    href: "/comment-to-dm",
    label: "Comment to DM",
    icon: MessageCircleReply,
    activePaths: ["/comment-to-dm", "/comment-triggers", "/dm-templates"],
    subLinks: [
      { href: "/comment-to-dm/activity", label: "Activity" },
    ],
  },
  { href: "/voice-replies", label: "Voice Replies", icon: Mic },
  { href: "/drip-sequences", label: "Follow-ups", icon: Send },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const settingsNavLinks = [
  { href: "/script-builder", label: "Sales Script", icon: Cpu },
  { href: "/playground", label: "Playground", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({
  pathname,
  onSignOut,
  conversationCount,
  onLinkClick,
  expanded = true,
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Logo */}
      <div
        className={`h-20 flex items-center ${
          expanded ? "px-6 gap-2.5" : "justify-center"
        }`}
      >
        <div className="w-8 h-8 bg-[#ff7e67] rounded-lg flex items-center justify-center shadow-lg shadow-[#ff7e67]/20 shrink-0">
          <Zap className="h-4 w-4 text-white" />
        </div>
        {expanded && (
          <span className="text-xl font-extrabold tracking-tight whitespace-nowrap">
            Clinchd
          </span>
        )}
      </div>

      {/* Navigation. overflow-x-hidden so labels clip cleanly while the
          sidebar width animates between collapsed and expanded. */}
      <nav
        className={`flex-1 ${
          expanded ? "px-4" : "px-2"
        } py-4 space-y-1 overflow-y-auto overflow-x-hidden`}
      >
        {mainNavLinks.map(({ href, label, icon: Icon, showBadge, activePaths, subLinks }) => {
          const matchPaths = activePaths || [href];
          const isActive = matchPaths.some(
            (p) => pathname === p || pathname.startsWith(p + "/")
          );
          return (
            <div key={href}>
              <Link
                href={href}
                onClick={onLinkClick}
                title={!expanded ? label : undefined}
                className={`relative flex items-center ${
                  expanded ? "gap-3 px-3" : "justify-center px-2"
                } py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? "bg-[#fff5f2] text-[#ff7e67] font-semibold"
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-900 font-medium"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {expanded && (
                  <>
                    <span className="whitespace-nowrap">{label}</span>
                    {showBadge && conversationCount > 0 && (
                      <span className="ml-auto bg-[#ff7e67] text-white text-[10px] px-2 py-0.5 rounded-full">
                        {conversationCount}
                      </span>
                    )}
                  </>
                )}
                {!expanded && showBadge && conversationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ff7e67]" />
                )}
              </Link>
              {expanded && isActive && subLinks && subLinks.length > 0 && (
                <div className="mt-1 ml-9 space-y-0.5">
                  {subLinks.map((sub) => {
                    const subActive =
                      pathname === sub.href ||
                      pathname.startsWith(sub.href + "/");
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={onLinkClick}
                        className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          subActive
                            ? "text-[#ff7e67] font-semibold"
                            : "text-stone-500 hover:text-stone-900 font-medium"
                        }`}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {expanded ? (
          <div className="pt-4 pb-2 px-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
            Settings
          </div>
        ) : (
          <div className="my-3 mx-2 border-t border-stone-200" />
        )}

        {settingsNavLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              title={!expanded ? label : undefined}
              className={`flex items-center ${
                expanded ? "gap-3 px-3" : "justify-center px-2"
              } py-2.5 rounded-xl transition-colors ${
                isActive
                  ? "bg-[#fff5f2] text-[#ff7e67] font-semibold"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-900 font-medium"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {expanded && <span className="whitespace-nowrap">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section. AccountUsageWidget is hidden when collapsed —
          too data-dense to render meaningfully in a 64px rail. */}
      <div
        className={`${expanded ? "p-4" : "p-2"} border-t border-stone-100 ${
          expanded ? "space-y-3" : ""
        }`}
      >
        {expanded && <AccountUsageWidget />}
        <button
          onClick={onSignOut}
          title={!expanded ? "Sign Out" : undefined}
          className={`w-full flex items-center justify-center gap-2 ${
            expanded ? "px-3 py-2" : "px-2 py-2.5"
          } text-stone-400 hover:text-stone-600 text-xs font-medium transition-colors`}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {expanded && "Sign Out"}
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
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
      {/* Desktop sidebar — collapsed to an icon rail by default, expands on
          hover. Fixed-position with a higher z-index so the expanded panel
          overlays the main content instead of reflowing it (main keeps its
          ml-16 offset regardless of state). */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 hidden md:block border-r border-stone-200 bg-white transition-[width] duration-200 ease-out ${
          hovered ? "w-64 shadow-2xl" : "w-16"
        }`}
      >
        <SidebarContent
          pathname={pathname}
          onSignOut={handleSignOut}
          conversationCount={conversationCount}
          expanded={hovered}
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
