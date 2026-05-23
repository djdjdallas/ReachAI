"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  CalendarCheck,
  Zap,
  DollarSign,
  TrendingUp,
  Info,
  Mail,
  UserCheck,
  Calendar,
  Loader2,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

const STATUS_BADGES = {
  confirmed: "bg-green-50 text-green-600",
  canceled: "bg-stone-100 text-stone-500",
  rescheduled: "bg-blue-50 text-blue-600",
};

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [timePeriod, setTimePeriod] = useState("30D");
  const [data, setData] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
    }
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function load() {
      setFetching(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics?period=${timePeriod}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to load analytics:", err);
        setError(err.message || "Failed to load analytics.");
      } finally {
        setFetching(false);
        setLoading(false);
      }
    }
    load();
  }, [timePeriod]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100 max-w-2xl">
          <h3 className="text-lg font-extrabold mb-2">Couldn&apos;t load analytics</h3>
          <p className="text-sm text-stone-500">{error}</p>
        </div>
      </div>
    );
  }

  const {
    kpis,
    totalConversations,
    leadQuality,
    dailyActivity,
    bookingsOverTime,
    recentBookings,
  } = data;

  const totalLeads =
    leadQuality.hot + leadQuality.warm + leadQuality.cold + leadQuality.booked;
  const hotPercent = totalLeads > 0 ? Math.round((leadQuality.hot / totalLeads) * 100) : 0;
  const warmPercent = totalLeads > 0 ? Math.round((leadQuality.warm / totalLeads) * 100) : 0;
  const coldPercent = totalLeads > 0 ? Math.round((leadQuality.cold / totalLeads) * 100) : 0;
  const bookedPercent = totalLeads > 0 ? Math.round((leadQuality.booked / totalLeads) * 100) : 0;

  const qualifiedCount = leadQuality.hot + leadQuality.warm + leadQuality.booked;
  const qualifyRate = totalConversations > 0
    ? ((qualifiedCount / totalConversations) * 100).toFixed(1)
    : "0.0";
  const conversionRateDisplay = kpis.conversionRate.value.toFixed(1);

  const revenueAvailable = kpis.revenue?.available;
  const dealValueAvailable = kpis.avgDealValue?.available;

  const kpiCards = [
    {
      title: "Total Calls Booked",
      value: kpis.bookings.value,
      delta: kpis.bookings.deltaPct,
      deltaPositive: kpis.bookings.deltaPositive,
      icon: CalendarCheck,
      iconBg: "bg-orange-50",
      iconColor: "text-[#ff7e67]",
    },
    {
      title: "Conversion Rate",
      value: `${conversionRateDisplay}%`,
      delta: kpis.conversionRate.deltaPct,
      deltaPositive: kpis.conversionRate.deltaPositive,
      icon: Zap,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
  ];

  if (revenueAvailable) {
    kpiCards.push({
      title: "Revenue Generated",
      value: `$${Number(kpis.revenue.value || 0).toLocaleString()}`,
      delta: kpis.revenue.deltaPct,
      deltaPositive: kpis.revenue.deltaPositive,
      icon: DollarSign,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    });
  }

  if (dealValueAvailable) {
    kpiCards.push({
      title: "Avg. Deal Value",
      value: `$${Number(kpis.avgDealValue.value || 0).toLocaleString()}`,
      delta: null,
      deltaPositive: null,
      icon: TrendingUp,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
    });
  }

  const gridCols =
    kpiCards.length >= 4
      ? "lg:grid-cols-4"
      : kpiCards.length === 3
      ? "lg:grid-cols-3"
      : "lg:grid-cols-2";

  return (
    <div className="p-8 space-y-8">
      {/* Title & Time Period */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-stone-900">Analytics</h2>
          <p className="text-stone-500 font-medium">
            Track your AI sales agent performance and ROI
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-white border border-stone-200 rounded-2xl soft-shadow">
          {["7D", "30D", "3M"].map((period) => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              disabled={fetching}
              className={`px-4 py-2 text-xs font-bold transition-colors rounded-xl ${
                timePeriod === period
                  ? "bg-[#fff5f2] text-[#ff7e67]"
                  : "text-stone-400 hover:text-stone-900"
              } disabled:opacity-50`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue setup hint */}
      {!revenueAvailable && (
        <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/50 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              Want to see real revenue from your bookings?
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Set your average deal value in{" "}
              <Link href="/settings" className="underline font-semibold">
                Settings → Revenue Tracking
              </Link>{" "}
              and it will appear here automatically.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${gridCols}`}>
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const DeltaIcon =
            card.delta == null
              ? Minus
              : card.deltaPositive
              ? ArrowUpRight
              : ArrowDownRight;
          const deltaColor =
            card.delta == null
              ? "text-stone-400 bg-stone-50"
              : card.deltaPositive
              ? "text-green-600 bg-green-50"
              : "text-red-500 bg-red-50";

          return (
            <div
              key={card.title}
              className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-10 h-10 ${card.iconBg} ${card.iconColor} rounded-xl flex items-center justify-center`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {card.delta != null ? (
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5 ${deltaColor}`}
                  >
                    <DeltaIcon className="h-3 w-3" />
                    {card.deltaPositive ? "+" : ""}
                    {card.delta}%
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-full ${deltaColor}`}
                  >
                    —
                  </span>
                )}
              </div>
              <p className="text-stone-400 text-xs font-bold uppercase tracking-tight mb-1">
                {card.title}
              </p>
              <h3 className="text-3xl font-extrabold">{card.value}</h3>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Daily Activity */}
        <div className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-extrabold">Daily Activity</h3>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              Messages/day
            </span>
          </div>
          <p className="text-xs text-stone-400 mb-6">
            Total messages (inbound + AI replies) per day in the selected period.
          </p>
          <Sparkline points={dailyActivity} color="#ff7e67" />
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100">
          <h3 className="text-lg font-extrabold mb-8">Conversion Funnel</h3>
          <div className="space-y-4">
            <FunnelRow
              icon={Mail}
              label="Conversations"
              value={totalConversations}
              percent={100}
            />
            <div className="flex justify-center">
              <ChevronDown className="h-4 w-4 text-stone-300" />
            </div>
            <FunnelRow
              icon={UserCheck}
              label="Qualified"
              value={qualifiedCount}
              percent={Number(qualifyRate)}
              suffix={`(${qualifyRate}%)`}
            />
            <div className="flex justify-center">
              <ChevronDown className="h-4 w-4 text-stone-300" />
            </div>
            <FunnelRow
              icon={Calendar}
              label="Calls Booked"
              value={kpis.bookings.value}
              percent={Number(conversionRateDisplay)}
              suffix={`(${conversionRateDisplay}%)`}
            />
          </div>
        </div>

        {/* Bookings Over Time */}
        <div className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-extrabold">Bookings Over Time</h3>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              Booked/day
            </span>
          </div>
          <p className="text-xs text-stone-400 mb-6">
            Calls booked per day, from Calendly or manual.
          </p>
          <Sparkline points={bookingsOverTime} color="#3b82f6" />
        </div>

        {/* Lead Quality Distribution */}
        <div className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100">
          <h3 className="text-lg font-extrabold mb-8">Lead Quality Distribution</h3>
          {totalLeads === 0 ? (
            <EmptyState message="No leads yet in this period." />
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-8">
              <Donut
                hot={hotPercent}
                warm={warmPercent}
                cold={coldPercent}
                booked={bookedPercent}
                total={totalLeads}
              />
              <div className="flex-1 space-y-3 w-full">
                <LegendRow color="#ff7e67" label="Hot" percent={hotPercent} count={leadQuality.hot} />
                <LegendRow color="#22c55e" label="Booked" percent={bookedPercent} count={leadQuality.booked} />
                <LegendRow color="#3b82f6" label="Warm" percent={warmPercent} count={leadQuality.warm} />
                <LegendRow color="#cbd5e1" label="Cold" percent={coldPercent} count={leadQuality.cold} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Bookings Table */}
      <div className="bg-white rounded-3xl soft-shadow border border-stone-100 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-xl font-extrabold">Recent Bookings</h3>
          <Link
            href="/calendar"
            className="text-[11px] font-bold text-[#ff7e67] hover:underline"
          >
            View Calendar
          </Link>
        </div>
        {recentBookings.length === 0 ? (
          <div className="p-12">
            <EmptyState message="No bookings yet. Once someone books a call through your Calendly, it will show up here." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50">
                  <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    Invitee
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    Event
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    Start
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    Source
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-5 font-bold text-sm">
                      {b.invitee_name || b.invitee_email || "—"}
                    </td>
                    <td className="px-6 py-5 text-sm text-stone-500">
                      {b.event_name || "—"}
                    </td>
                    <td className="px-6 py-5 text-sm text-stone-500">
                      {b.start_time ? formatDateTime(b.start_time) : "—"}
                    </td>
                    <td className="px-6 py-5 text-sm text-stone-500 capitalize">
                      {b.source || "manual"}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize ${
                          STATUS_BADGES[b.status] || "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {b.status || "confirmed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkline({ points, color }) {
  if (!points || points.length === 0) {
    return <EmptyState message="No data yet." />;
  }

  const values = points.map((p) => p.count);
  const max = Math.max(...values, 1);
  const width = 400;
  const height = 150;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: height - (p.count / max) * (height - 10) - 5,
  }));

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  const hasAny = values.some((v) => v > 0);

  return (
    <div>
      <div className="relative h-[180px]">
        <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#spark-${color.replace("#", "")})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {!hasAny && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-stone-400">No activity yet.</span>
          </div>
        )}
      </div>
      <div className="flex justify-between mt-2 text-[10px] font-bold text-stone-400">
        <span>{formatShortDate(points[0].date)}</span>
        {points.length > 2 && (
          <span>{formatShortDate(points[Math.floor(points.length / 2)].date)}</span>
        )}
        <span>{formatShortDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}

function FunnelRow({ icon: Icon, label, value, percent, suffix }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-bold mb-1.5">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#ff7e67]" /> {label}
        </span>
        <span>
          {value} {suffix || ""}
        </span>
      </div>
      <div className="h-10 bg-stone-50 rounded-xl overflow-hidden">
        <div className="h-full bg-[#ff7e67]/20 w-full flex items-center px-4">
          <div
            className="h-2 bg-[#ff7e67] rounded-full transition-all"
            style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Donut({ hot, warm, cold, booked, total }) {
  // Draw stacked segments on a 100-unit circumference circle.
  const segments = [
    { value: hot, color: "#ff7e67" },
    { value: booked, color: "#22c55e" },
    { value: warm, color: "#3b82f6" },
    { value: cold, color: "#cbd5e1" },
  ].filter((s) => s.value > 0);

  let offset = 25; // start at top
  return (
    <div className="relative w-40 h-40">
      <svg viewBox="0 0 36 36" className="w-full h-full">
        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
        {segments.map((s, i) => {
          const dasharray = `${s.value} ${100 - s.value}`;
          const dashoffset = offset;
          offset -= s.value;
          return (
            <circle
              key={i}
              cx="18"
              cy="18"
              r="15.915"
              fill="transparent"
              stroke={s.color}
              strokeWidth="4"
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black">{total}</span>
        <span className="text-[10px] font-bold text-stone-400 uppercase">Leads</span>
      </div>
    </div>
  );
}

function LegendRow({ color, label, percent, count }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-bold text-stone-500">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-stone-400">{count}</span>
        <span className="text-xs font-black">{percent}%</span>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex items-center justify-center h-[180px] text-xs text-stone-400 text-center">
      {message}
    </div>
  );
}

function formatShortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
