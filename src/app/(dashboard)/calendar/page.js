"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Clock,
  Hourglass,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const days = [];

  // Previous month overflow
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ day: prevMonthLastDay - i, currentMonth: false, date: new Date(year, month - 1, prevMonthLastDay - i) });
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ day: d, currentMonth: true, date: new Date(year, month, d) });
  }

  // Next month overflow
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ day: d, currentMonth: false, date: new Date(year, month + 1, d) });
  }

  return days;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

export default function CalendarPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const calendarDays = getCalendarDays(year, month);
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: userProfile } = await supabase
        .from("users")
        .select("calendly_url")
        .eq("id", user.id)
        .single();
      if (userProfile) setProfile(userProfile);

      const { data: convos } = await supabase
        .from("conversations")
        .select("id, sender_name, updated_at, status")
        .eq("user_id", user.id)
        .eq("status", "booked")
        .order("updated_at", { ascending: true });

      setBookings(convos || []);
      setLoading(false);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getBookingsForDay = (date) =>
    bookings.filter((b) => isSameDay(new Date(b.updated_at), date));

  const upcomingBookings = bookings.filter((b) => new Date(b.updated_at) >= today);
  const pastBookings = bookings.filter((b) => new Date(b.updated_at) < today);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-extrabold mb-1">{monthName}</h2>
            <p className="text-stone-500 font-medium">
              You have {bookings.length} calls scheduled.
            </p>
          </div>
          <div className="flex items-center bg-white p-1 rounded-2xl border border-stone-200 soft-shadow">
            <button
              onClick={() => setViewMode("month")}
              className={`px-6 py-2 rounded-xl text-sm font-bold ${viewMode === "month" ? "bg-[#fff5f2] text-[#ff7e67]" : "text-stone-500 hover:text-stone-900"} transition-colors`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-6 py-2 rounded-xl text-sm font-bold ${viewMode === "week" ? "bg-[#fff5f2] text-[#ff7e67]" : "text-stone-500 hover:text-stone-900"} transition-colors`}
            >
              Week
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-2.5 rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition-all">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={nextMonth} className="p-2.5 rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition-all">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Calendar Grid */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-stone-200 overflow-hidden soft-shadow">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-stone-100">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-4 text-center text-[11px] font-black text-stone-400 uppercase tracking-widest">
                  {d}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-stone-100">
              {calendarDays.map((day, idx) => {
                const dayBookings = getBookingsForDay(day.date);
                const isToday = isSameDay(day.date, today);
                return (
                  <div
                    key={idx}
                    className={`min-h-[100px] p-3 ${!day.currentMonth ? "bg-stone-50/50 text-stone-300" : "text-stone-900"} ${isToday ? "bg-[#fff5f2]/30" : ""}`}
                  >
                    <span className={`text-sm font-bold ${isToday ? "flex items-center justify-center w-7 h-7 bg-[#ff7e67] text-white rounded-full" : ""}`}>
                      {day.day}
                    </span>
                    {dayBookings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {dayBookings.slice(0, 2).map((b) => (
                          <div key={b.id} className="bg-[#fff5f2] border border-[#ff7e67]/20 p-1.5 rounded-lg">
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-[#ff7e67] rounded-full" />
                              <span className="text-[9px] truncate">
                                {new Date(b.updated_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - {b.sender_name?.split(" ")[0] || "Lead"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-4 space-y-6">
            {/* Sync Status */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 soft-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold">Sync Status</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${profile?.calendly_url ? "bg-green-50 text-green-600" : "bg-stone-100 text-stone-400"}`}>
                  {profile?.calendly_url ? "Active" : "Not Set"}
                </span>
              </div>
              <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-stone-100 flex items-center justify-center">
                  <span className="text-blue-500 text-lg font-bold">C</span>
                </div>
                <div>
                  <p className="text-sm font-bold">Calendly Integration</p>
                  <p className="text-[11px] text-stone-500">
                    {profile?.calendly_url ? "Connected" : "Not connected yet"}
                  </p>
                </div>
                <button className="ml-auto text-stone-400 hover:text-stone-900">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Upcoming Calls */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 soft-shadow">
              <h3 className="text-lg font-extrabold mb-6">Upcoming Calls</h3>
              <div className="space-y-4">
                {upcomingBookings.slice(0, 3).map((booking) => (
                  <div key={booking.id} className="p-4 rounded-2xl border border-stone-100 bg-[#fff5f2] relative group cursor-pointer hover:border-[#ff7e67]/30 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-10 w-10 rounded-full bg-white ring-2 ring-white shadow-sm">
                        <AvatarFallback className="bg-stone-100 text-stone-600 text-xs">
                          {getInitials(booking.sender_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-bold">{booking.sender_name || "Unknown"}</p>
                        <p className="text-[11px] text-[#ff7e67] font-medium">Booked Lead</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-stone-600 text-[13px] font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-stone-400" />
                        {new Date(booking.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Hourglass className="h-4 w-4 text-stone-400" />
                        30 mins
                      </div>
                    </div>
                    <button className="absolute top-4 right-4 text-stone-300 group-hover:text-stone-600 transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {upcomingBookings.length === 0 && (
                  <p className="text-sm text-stone-400 text-center py-6">No upcoming calls</p>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-stone-200 soft-shadow">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Completed</p>
                <p className="text-2xl font-black">{pastBookings.length}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-stone-200 soft-shadow">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Upcoming</p>
                <p className="text-2xl font-black">{upcomingBookings.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
