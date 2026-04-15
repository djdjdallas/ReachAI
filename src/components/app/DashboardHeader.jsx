"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Zap, Flame, CalendarCheck, Check, Loader2 } from "lucide-react";
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

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState(null);

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("users")
          .select("full_name, ai_mode, instagram_business_account_id")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      }
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  // Fetch unread count on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    if (!notifOpen) return;
    const handleClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  const toggleDropdown = useCallback(() => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening) fetchNotifications();
  }, [notifOpen, fetchNotifications]);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (e) {
      console.error("Failed to mark all read:", e);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark read optimistically
    if (!notification.read_at) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notification.id] }),
      }).catch(() => {});
    }

    setNotifOpen(false);
    if (notification.event_type === "hot_lead_alert" && notification.metadata?.conversation_id) {
      router.push(`/conversations?thread=${notification.metadata.conversation_id}`);
    } else if (notification.event_type === "booking_alert") {
      router.push("/calendar");
    }
  };

  const title =
    PAGE_TITLES[pathname] ||
    PAGE_TITLES[Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k))] ||
    "Dashboard";

  const aiMode = profile?.ai_mode;
  const instagramConnected = !!profile?.instagram_business_account_id;

  return (
    <header className="h-16 bg-white border-b border-stone-200 px-6 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {aiMode === "active" && instagramConnected && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            AGENT ACTIVE
          </div>
        )}
        {aiMode === "handoff" && instagramConnected && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            HANDOFF MODE
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Bell + Notification Dropdown */}
        <div className="relative">
          <button
            ref={bellRef}
            onClick={toggleDropdown}
            className="w-10 h-10 flex items-center justify-center text-stone-500 hover:text-stone-900 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#ff7e67] rounded-full ring-2 ring-white" />
            )}
          </button>

          {notifOpen && (
            <div
              ref={dropdownRef}
              className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl border border-stone-200 shadow-lg z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
                <h3 className="text-sm font-extrabold">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs font-medium text-[#ff7e67] hover:text-[#e86b55] transition-colors"
                  >
                    <Check className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifLoading && notifications.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Bell className="h-8 w-8 mx-auto text-stone-300 mb-2" />
                    <p className="text-sm font-medium text-stone-400">No notifications yet</p>
                    <p className="text-xs text-stone-400 mt-1">
                      We&apos;ll notify you when leads heat up
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0 ${
                        !n.read_at ? "bg-orange-50/40" : ""
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          n.event_type === "hot_lead_alert"
                            ? "bg-orange-100 text-orange-600"
                            : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        {n.event_type === "hot_lead_alert" ? (
                          <Flame className="h-4 w-4" />
                        ) : (
                          <CalendarCheck className="h-4 w-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">
                          {n.event_type === "hot_lead_alert" ? "Hot Lead Alert" : "Call Booked"}
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {n.event_type === "hot_lead_alert"
                            ? "A lead has been flagged as interested"
                            : "A discovery call was booked"}
                        </p>
                      </div>

                      {/* Timestamp + unread dot */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        <span className="text-[11px] text-stone-400">
                          {timeAgo(n.sent_at)}
                        </span>
                        {!n.read_at && (
                          <span className="w-2 h-2 bg-[#ff7e67] rounded-full" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
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
