"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Hourglass,
  ExternalLink,
  Loader2,
  Calendar,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

function getWeekDays(date) {
  const dayOfWeek = date.getDay();
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push({ day: d.getDate(), currentMonth: d.getMonth() === date.getMonth(), date: d });
  }
  return days;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(start, end) {
  if (!start || !end) return "";
  const mins = Math.round((new Date(end) - new Date(start)) / 60000);
  if (mins < 60) return `${mins} mins`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

const SOURCE_COLORS = {
  calendly: { bg: "bg-[#fff5f2]", border: "border-[#ff7e67]/20", dot: "bg-[#ff7e67]", text: "text-[#ff7e67]" },
  google_calendar: { bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500", text: "text-blue-600" },
  manual: { bg: "bg-stone-50", border: "border-stone-200", dot: "bg-stone-400", text: "text-stone-600" },
};

function SourceBadge({ source }) {
  const label = source === "google_calendar" ? "Google" : source === "calendly" ? "Calendly" : "Manual";
  const colors = SOURCE_COLORS[source] || SOURCE_COLORS.manual;
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight ${colors.bg} ${colors.text}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === "canceled") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight bg-red-50 text-red-500">
        Canceled
      </span>
    );
  }
  return null;
}

export default function CalendarPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const calendarDays = getCalendarDays(year, month);
  const weekDays = getWeekDays(currentDate);
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    fetchData();
  }, [currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    // Fetch user profile
    const { data: userProfile } = await supabase
      .from("users")
      .select("calendly_url, google_calendar_refresh_token")
      .eq("id", user.id)
      .single();
    if (userProfile) setProfile(userProfile);

    // Date range for queries
    const rangeStart = new Date(year, month, 1).toISOString();
    const rangeEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    // Fetch bookings from DB and Google Calendar events in parallel
    const [bookingsResult, gcalResult] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, invitee_name, invitee_email, event_name, start_time, end_time, status, source, calendly_event_uri")
        .eq("user_id", user.id)
        .gte("start_time", rangeStart)
        .lte("start_time", rangeEnd)
        .order("start_time", { ascending: true }),
      fetch(`/api/google-calendar/events?timeMin=${encodeURIComponent(rangeStart)}&timeMax=${encodeURIComponent(rangeEnd)}`)
        .then((r) => r.json())
        .catch(() => ({ events: [], connected: false })),
    ]);

    // Normalize bookings
    const normalizedBookings = (bookingsResult.data || []).map((b) => ({
      id: b.id,
      title: b.event_name || "Booking",
      name: b.invitee_name,
      start: b.start_time,
      end: b.end_time,
      status: b.status,
      source: b.source || "calendly",
    }));

    // Normalize Google Calendar events
    const normalizedGcal = (gcalResult.events || []).map((e) => ({
      id: e.id,
      title: e.title,
      name: null,
      start: e.start,
      end: e.end,
      status: "confirmed",
      source: "google_calendar",
    }));

    setGcalConnected(gcalResult.connected || false);

    // Merge and sort
    const merged = [...normalizedBookings, ...normalizedGcal].sort(
      (a, b) => new Date(a.start) - new Date(b.start)
    );

    setEvents(merged);
    setLoading(false);
  }

  const prev = () => {
    if (viewMode === "week") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };
  const next = () => {
    if (viewMode === "week") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    await fetchData();
    setSyncing(false);
  };

  const getEventsForDay = (date) =>
    events.filter((e) => e.start && isSameDay(new Date(e.start), date));

  const confirmedEvents = events.filter((e) => e.status !== "canceled");
  const upcomingEvents = confirmedEvents.filter((e) => new Date(e.start) >= today);
  const pastEvents = confirmedEvents.filter((e) => new Date(e.start) < today);

  const hasCalendlyUrl = !!profile?.calendly_url;

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
            <h2 className="text-3xl font-extrabold mb-1">
              {viewMode === "week"
                ? `${weekDays[0].date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[6].date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : monthName}
            </h2>
            <p className="text-stone-500 font-medium">
              You have {confirmedEvents.length} event{confirmedEvents.length !== 1 ? "s" : ""} this month.
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
            <button onClick={prev} className="p-2.5 rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition-all">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={next} className="p-2.5 rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition-all">
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
            {viewMode === "month" ? (
              <div className="grid grid-cols-7 divide-x divide-y divide-stone-100">
                {calendarDays.map((day, idx) => {
                  const dayEvents = getEventsForDay(day.date);
                  const isToday = isSameDay(day.date, today);
                  return (
                    <div
                      key={idx}
                      className={`min-h-[100px] p-3 ${!day.currentMonth ? "bg-stone-50/50 text-stone-300" : "text-stone-900"} ${isToday ? "bg-[#fff5f2]/30" : ""}`}
                    >
                      <span className={`text-sm font-bold ${isToday ? "flex items-center justify-center w-7 h-7 bg-[#ff7e67] text-white rounded-full" : ""}`}>
                        {day.day}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {dayEvents.slice(0, 2).map((e) => {
                            const colors = SOURCE_COLORS[e.source] || SOURCE_COLORS.manual;
                            return (
                              <div
                                key={e.id}
                                className={`${colors.bg} border ${colors.border} p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${e.status === "canceled" ? "opacity-50 line-through" : ""}`}
                                onClick={() => setSelectedEvent(e)}
                              >
                                <div className="flex items-center gap-1">
                                  <div className={`w-1.5 h-1.5 ${colors.dot} rounded-full shrink-0`} />
                                  <span className="text-[9px] truncate">
                                    {formatTime(e.start)} - {e.name || e.title}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                          {dayEvents.length > 2 && (
                            <button
                              className="text-[9px] text-stone-400 font-medium hover:text-stone-600 transition-colors"
                              onClick={() => setSelectedEvent(dayEvents[0])}
                            >
                              +{dayEvents.length - 2} more
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-7 divide-x divide-stone-100">
                {weekDays.map((day, idx) => {
                  const dayEvents = getEventsForDay(day.date);
                  const isToday = isSameDay(day.date, today);
                  return (
                    <div
                      key={idx}
                      className={`min-h-[300px] p-3 ${!day.currentMonth ? "bg-stone-50/50 text-stone-300" : "text-stone-900"} ${isToday ? "bg-[#fff5f2]/30" : ""}`}
                    >
                      <span className={`text-sm font-bold ${isToday ? "flex items-center justify-center w-7 h-7 bg-[#ff7e67] text-white rounded-full" : ""}`}>
                        {day.day}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {dayEvents.map((e) => {
                            const colors = SOURCE_COLORS[e.source] || SOURCE_COLORS.manual;
                            return (
                              <div
                                key={e.id}
                                className={`${colors.bg} border ${colors.border} p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${e.status === "canceled" ? "opacity-50 line-through" : ""}`}
                                onClick={() => setSelectedEvent(e)}
                              >
                                <div className="flex items-center gap-1">
                                  <div className={`w-1.5 h-1.5 ${colors.dot} rounded-full shrink-0`} />
                                  <span className="text-[9px] truncate">
                                    {formatTime(e.start)} - {e.name || e.title}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-4 space-y-6">
            {/* Sync Status */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 soft-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold">Integrations</h3>
              </div>
              <div className="space-y-3">
                {/* Calendly status */}
                <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-stone-100 flex items-center justify-center">
                    <span className="text-[#ff7e67] text-lg font-bold">C</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">Calendly</p>
                    <p className="text-[11px] text-stone-500">
                      {hasCalendlyUrl ? "Connected" : "Not connected"}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${hasCalendlyUrl ? "bg-green-50 text-green-600" : "bg-stone-100 text-stone-400"}`}>
                    {hasCalendlyUrl ? "Active" : "Not Set"}
                  </span>
                </div>
                {/* Google Calendar status */}
                <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-stone-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">Google Calendar</p>
                    <p className="text-[11px] text-stone-500">
                      {gcalConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                  {gcalConnected ? (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter bg-green-50 text-green-600">
                        Active
                      </span>
                      <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all disabled:opacity-50"
                        title="Sync now"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  ) : (
                    <a
                      href="/api/auth/google-calendar"
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                    >
                      Connect
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Upcoming Events */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 soft-shadow">
              <h3 className="text-lg font-extrabold mb-6">Upcoming</h3>
              <div className="space-y-4">
                {upcomingEvents.slice(0, 4).map((evt) => (
                  <div key={evt.id} className="p-4 rounded-2xl border border-stone-100 bg-[#fff5f2] relative group cursor-pointer hover:border-[#ff7e67]/30 transition-all" onClick={() => setSelectedEvent(evt)}>
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-10 w-10 rounded-full bg-white ring-2 ring-white shadow-sm">
                        <AvatarFallback className="bg-stone-100 text-stone-600 text-xs">
                          {getInitials(evt.name || evt.title)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{evt.name || evt.title}</p>
                        <div className="flex items-center gap-2">
                          <SourceBadge source={evt.source} />
                          <StatusBadge status={evt.status} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-stone-600 text-[13px] font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-stone-400" />
                        {formatDate(evt.start)} {formatTime(evt.start)}
                      </div>
                      {evt.end && (
                        <div className="flex items-center gap-1.5">
                          <Hourglass className="h-4 w-4 text-stone-400" />
                          {formatDuration(evt.start, evt.end)}
                        </div>
                      )}
                    </div>
                    <button className="absolute top-4 right-4 text-stone-300 group-hover:text-stone-600 transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {upcomingEvents.length === 0 && (
                  <p className="text-sm text-stone-400 text-center py-6">No upcoming events</p>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-stone-200 soft-shadow">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Completed</p>
                <p className="text-2xl font-black">{pastEvents.length}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-stone-200 soft-shadow">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Upcoming</p>
                <p className="text-2xl font-black">{upcomingEvents.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Event Detail Modal */}
        <Dialog open={!!selectedEvent} onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}>
          <DialogContent className="rounded-3xl border-stone-200 bg-white p-0 max-w-md">
            <div className="p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-extrabold">
                  {selectedEvent?.title || selectedEvent?.name || "Event"}
                </DialogTitle>
                <DialogDescription className="sr-only">Event details</DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 mt-3">
                <SourceBadge source={selectedEvent?.source} />
                <StatusBadge status={selectedEvent?.status} />
              </div>

              {selectedEvent?.name && selectedEvent?.name !== selectedEvent?.title && (
                <div className="flex items-center gap-3 mt-5">
                  <Avatar className="h-10 w-10 rounded-full bg-stone-100 ring-2 ring-white shadow-sm">
                    <AvatarFallback className="bg-stone-100 text-stone-600 text-xs">
                      {getInitials(selectedEvent.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-bold">{selectedEvent.name}</span>
                </div>
              )}

              <div className="mt-5 space-y-3 text-sm text-stone-600">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-stone-400" />
                  <span className="font-medium">{formatDate(selectedEvent?.start)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-stone-400" />
                  <span className="font-medium">
                    {formatTime(selectedEvent?.start)}
                    {selectedEvent?.end && ` – ${formatTime(selectedEvent?.end)}`}
                  </span>
                </div>
                {selectedEvent?.end && (
                  <div className="flex items-center gap-2">
                    <Hourglass className="h-4 w-4 text-stone-400" />
                    <span className="font-medium">{formatDuration(selectedEvent?.start, selectedEvent?.end)}</span>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
