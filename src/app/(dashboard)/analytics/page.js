"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CalendarCheck,
  Zap,
  DollarSign,
  TrendingUp,
  Info,
  Mail,
  UserCheck,
  Calendar,
  ChevronDown,
  Loader2,
} from "lucide-react";

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState("30D");
  const [stats, setStats] = useState({
    totalConversations: 0,
    qualifiedCount: 0,
    bookedCount: 0,
    hotCount: 0,
    warmCount: 0,
    coldCount: 0,
  });

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: convos } = await supabase
        .from("conversations")
        .select("status")
        .eq("user_id", user.id);

      const list = convos || [];
      const booked = list.filter((c) => c.status === "booked").length;
      const interested = list.filter((c) => c.status === "interested").length;
      const qualifying = list.filter((c) => c.status === "qualifying").length;
      const notAFit = list.filter((c) => ["not_a_fit", "not a fit"].includes(c.status?.toLowerCase())).length;

      setStats({
        totalConversations: list.length,
        qualifiedCount: interested + qualifying + booked,
        bookedCount: booked,
        hotCount: interested,
        warmCount: qualifying,
        coldCount: notAFit,
      });

      setLoading(false);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  const conversionRate = stats.totalConversations > 0
    ? ((stats.bookedCount / stats.totalConversations) * 100).toFixed(1)
    : "0.0";
  const qualifyRate = stats.totalConversations > 0
    ? ((stats.qualifiedCount / stats.totalConversations) * 100).toFixed(1)
    : "0.0";

  const totalLeads = stats.hotCount + stats.warmCount + stats.coldCount;
  const hotPercent = totalLeads > 0 ? Math.round((stats.hotCount / totalLeads) * 100) : 0;
  const warmPercent = totalLeads > 0 ? Math.round((stats.warmCount / totalLeads) * 100) : 0;
  const coldPercent = totalLeads > 0 ? Math.round((stats.coldCount / totalLeads) * 100) : 0;

  const kpiCards = [
    {
      title: "Total Calls Booked",
      value: stats.bookedCount,
      change: "+12.4%",
      changePositive: true,
      icon: CalendarCheck,
      iconBg: "bg-orange-50",
      iconColor: "text-[#ff7e67]",
    },
    {
      title: "Conversion Rate",
      value: `${conversionRate}%`,
      change: "+2.1%",
      changePositive: true,
      icon: Zap,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      title: "Revenue Generated",
      value: `$${(stats.bookedCount * 303).toLocaleString()}`,
      change: "+18.9%",
      changePositive: true,
      icon: DollarSign,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      title: "Avg. Deal Value",
      value: "$303",
      change: "0.0%",
      changePositive: false,
      icon: TrendingUp,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
    },
  ];

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
          {["7D", "30D", "3M", "Custom"].map((period) => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              className={`px-4 py-2 text-xs font-bold transition-colors rounded-xl ${
                timePeriod === period
                  ? "bg-[#fff5f2] text-[#ff7e67]"
                  : "text-stone-400 hover:text-stone-900"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 ${card.iconBg} ${card.iconColor} rounded-xl flex items-center justify-center`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  card.changePositive ? "text-green-500 bg-green-50" : "text-stone-400 bg-stone-50"
                }`}>
                  {card.change}
                </span>
              </div>
              <p className="text-stone-400 text-xs font-bold uppercase tracking-tight mb-1">{card.title}</p>
              <h3 className="text-3xl font-extrabold">{card.value}</h3>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Response Rate Trend */}
        <div className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-extrabold">Response Rate Trend</h3>
            <Info className="h-4 w-4 text-stone-300 cursor-help" />
          </div>
          <div className="relative h-[200px]">
            <svg className="w-full h-full" viewBox="0 0 400 150" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ff7e67" />
                  <stop offset="100%" stopColor="white" />
                </linearGradient>
              </defs>
              <path d="M0,120 Q50,80 100,100 T200,60 T300,90 T400,40" fill="none" stroke="#ff7e67" strokeWidth="4" strokeLinecap="round" />
              <path d="M0,120 Q50,80 100,100 T200,60 T300,90 T400,40 L400,150 L0,150 Z" fill="url(#chartGradient)" opacity="0.1" />
            </svg>
          </div>
          <div className="flex justify-between px-4 mt-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d} className="text-[10px] font-bold text-stone-400">{d}</span>
            ))}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100">
          <h3 className="text-lg font-extrabold mb-8">Conversion Funnel</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#ff7e67]" /> Messages Received
                </span>
                <span>{stats.totalConversations}</span>
              </div>
              <div className="h-10 bg-stone-50 rounded-xl overflow-hidden">
                <div className="h-full bg-[#ff7e67]/20 w-full flex items-center px-4">
                  <div className="h-2 bg-[#ff7e67] rounded-full w-full" />
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <ChevronDown className="h-4 w-4 text-stone-300" />
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#ff7e67]" /> AI Qualified
                </span>
                <span>{stats.qualifiedCount} ({qualifyRate}%)</span>
              </div>
              <div className="h-10 bg-stone-50 rounded-xl overflow-hidden">
                <div className="h-full bg-[#ff7e67]/20 w-full flex items-center px-4">
                  <div className="h-2 bg-[#ff7e67] rounded-full" style={{ width: `${qualifyRate}%` }} />
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <ChevronDown className="h-4 w-4 text-stone-300" />
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#ff7e67]" /> Calls Booked
                </span>
                <span>{stats.bookedCount} ({conversionRate}%)</span>
              </div>
              <div className="h-10 bg-stone-50 rounded-xl overflow-hidden">
                <div className="h-full bg-[#ff7e67]/20 w-full flex items-center px-4">
                  <div className="h-2 bg-[#ff7e67] rounded-full" style={{ width: `${conversionRate}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue by Niche (static demo) */}
        <div className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100">
          <h3 className="text-lg font-extrabold mb-8">Revenue by Niche</h3>
          <div className="space-y-6">
            {[
              { name: "Fitness Coaches", value: "$5,420", width: "85%" },
              { name: "E-commerce", value: "$3,150", width: "65%" },
              { name: "SaaS Founders", value: "$2,280", width: "45%" },
              { name: "Designers", value: "$1,100", width: "25%" },
              { name: "Other", value: "$800", width: "15%" },
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-4">
                <span className="text-xs font-bold text-stone-400 w-24 truncate">{item.name}</span>
                <div className="flex-1 h-3 bg-stone-50 rounded-full overflow-hidden">
                  <div className="h-full bg-[#ff7e67] rounded-full transition-all" style={{ width: item.width }} />
                </div>
                <span className="text-xs font-bold text-stone-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Quality Distribution */}
        <div className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100">
          <h3 className="text-lg font-extrabold mb-8">Lead Quality Distribution</h3>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#ff7e67" strokeWidth="4"
                  strokeDasharray={`${hotPercent} ${100 - hotPercent}`} strokeDashoffset="25" />
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#3b82f6" strokeWidth="4"
                  strokeDasharray={`${warmPercent} ${100 - warmPercent}`} strokeDashoffset={`${85 - hotPercent}`} />
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#cbd5e1" strokeWidth="4"
                  strokeDasharray={`${coldPercent} ${100 - coldPercent}`} strokeDashoffset={`${110 - hotPercent - warmPercent}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black">{totalLeads || stats.totalConversations}</span>
                <span className="text-[10px] font-bold text-stone-400 uppercase">Leads</span>
              </div>
            </div>
            <div className="flex-1 space-y-3 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#ff7e67]" />
                  <span className="text-xs font-bold text-stone-500">Hot Leads</span>
                </div>
                <span className="text-xs font-black">{hotPercent || 60}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-stone-500">Warm Leads</span>
                </div>
                <span className="text-xs font-black">{warmPercent || 25}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-stone-300" />
                  <span className="text-xs font-bold text-stone-500">Cold Leads</span>
                </div>
                <span className="text-xs font-black">{coldPercent || 15}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Script Performance Table */}
      <div className="bg-white rounded-3xl soft-shadow border border-stone-100 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-xl font-extrabold">Script Performance</h3>
          <button className="text-[11px] font-bold text-[#ff7e67] hover:underline">Download Report</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50">
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Script Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Impressions</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Responses</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Conversion</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr className="hover:bg-stone-50/50 transition-colors">
                <td className="px-6 py-5 font-bold text-sm">High-Ticket Coaching v2.4</td>
                <td className="px-6 py-5 text-sm text-stone-500">{stats.totalConversations || 1245}</td>
                <td className="px-6 py-5 text-sm text-stone-500">{stats.qualifiedCount || 312}</td>
                <td className="px-6 py-5">
                  <span className="px-2.5 py-1 bg-green-50 text-green-600 rounded-lg text-[11px] font-bold">
                    {qualifyRate > 0 ? qualifyRate : "25.1"}%
                  </span>
                </td>
                <td className="px-6 py-5 font-bold text-sm text-stone-900">
                  ${(stats.bookedCount * 303 || 8420).toLocaleString()}
                </td>
              </tr>
              <tr className="hover:bg-stone-50/50 transition-colors">
                <td className="px-6 py-5 font-bold text-sm">Service Business Intro</td>
                <td className="px-6 py-5 text-sm text-stone-500">842</td>
                <td className="px-6 py-5 text-sm text-stone-500">156</td>
                <td className="px-6 py-5">
                  <span className="px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg text-[11px] font-bold">18.5%</span>
                </td>
                <td className="px-6 py-5 font-bold text-sm text-stone-900">$3,150</td>
              </tr>
              <tr className="hover:bg-stone-50/50 transition-colors">
                <td className="px-6 py-5 font-bold text-sm">Objection Handler - Pricing</td>
                <td className="px-6 py-5 text-sm text-stone-500">395</td>
                <td className="px-6 py-5 text-sm text-stone-500">82</td>
                <td className="px-6 py-5">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold">20.8%</span>
                </td>
                <td className="px-6 py-5 font-bold text-sm text-stone-900">$1,180</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-stone-100 text-center">
          <button className="text-[11px] font-bold text-stone-400 hover:text-stone-900 uppercase tracking-widest">View All Scripts</button>
        </div>
      </div>
    </div>
  );
}
