"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  LayoutDashboard,
  MessageSquare,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  Instagram,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/script-builder", label: "Script Builder", icon: FileText },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ pathname, userEmail, profile, onSignOut, onLinkClick }) {
  const aiActive = profile?.ai_active;
  const igConnected = !!profile?.unipile_account_id;

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-white/10">
        <div className="w-8 h-8 bg-[#ff7e67] rounded-xl flex items-center justify-center shadow-lg shadow-[#ff7e67]/20">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-extrabold tracking-tight">Clinchd</span>
      </div>

      {/* Status indicators */}
      <div className="px-4 py-3 space-y-2 border-b border-white/10">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-medium text-sidebar-foreground/50">AI Status</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${aiActive ? "bg-green-500" : "bg-red-400"}`} />
            <span className={`text-xs font-medium ${aiActive ? "text-green-400" : "text-red-400"}`}>
              {aiActive ? "Active" : "Paused"}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-medium text-sidebar-foreground/50">Instagram</span>
          <div className="flex items-center gap-1.5">
            <Instagram className="h-3 w-3 text-sidebar-foreground/50" />
            <span className={`text-xs font-medium ${igConnected ? "text-green-400" : "text-red-400"}`}>
              {igConnected ? "Connected" : "Not Connected"}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#ff7e67]/15 text-[#ff7e67]"
                  : "text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 px-4 py-4 space-y-3">
        {userEmail && (
          <p className="text-xs text-sidebar-foreground/50 truncate">
            {userEmail}
          </p>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/5"
          onClick={onSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email);
        supabase
          .from("users")
          .select("ai_active, unipile_account_id")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      }
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 hidden md:block">
        <SidebarContent
          pathname={pathname}
          userEmail={userEmail}
          profile={profile}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Mobile hamburger + sheet */}
      <div className="fixed top-0 left-0 right-0 z-50 md:hidden flex items-center h-14 px-4 bg-sidebar border-b border-white/10">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-sidebar border-r-0">
            <SidebarContent
              pathname={pathname}
              userEmail={userEmail}
              profile={profile}
              onSignOut={handleSignOut}
              onLinkClick={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2 ml-2">
          <div className="w-7 h-7 bg-[#ff7e67] rounded-lg flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-base font-extrabold text-sidebar-foreground">Clinchd</span>
        </div>
      </div>
    </>
  );
}
