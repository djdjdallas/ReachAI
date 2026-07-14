"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  CalendarCheck,
  Zap,
  Clock,
  TrendingUp,
  Instagram,
  AlertTriangle,
  ExternalLink,
  Eye,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import StatusBadge from "@/components/app/StatusBadge";
import { parseTimestamp, relativeTime } from "@/lib/dates";

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100">
            <Skeleton className="h-4 w-24 mb-4" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-3xl soft-shadow border border-stone-100 p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    dmsHandled: 0,
    callsBooked: 0,
    callsBookedThisWeek: 0,
    conversionRate: 0,
    responseRate: 0,
    avgQualifyMinutes: 0,
    activeConversations: 0,
  });
  const [conversations, setConversations] = useState([]);

  const fetchData = useCallback(
    async (userId) => {
      const uid = userId || user?.id;
      if (!uid) return;

      const { data: convos } = await supabase
        .from("conversations")
        .select("*, messages(content, created_at, role)")
        .eq("user_id", uid)
        .order("last_message_at", { ascending: false })
        .limit(20);

      const convList = (convos || []).map((convo) => {
        const sorted = (convo.messages || []).sort(
          (a, b) => parseTimestamp(b.created_at) - parseTimestamp(a.created_at)
        );
        const lastMsg = sorted[0];
        return {
          ...convo,
          last_message: lastMsg?.content || null,
          last_message_role: lastMsg?.role || null,
          messages: undefined,
        };
      });
      setConversations(convList);

      const totalConversations = convList.length;
      const booked = convList.filter(
        (c) => c.status?.toLowerCase() === "booked"
      ).length;
      const active = convList.filter((c) =>
        ["qualifying", "interested"].includes(c.status?.toLowerCase())
      ).length;
      const bookingRate =
        totalConversations > 0
          ? Math.round((booked / totalConversations) * 100)
          : 0;

      // Calls booked this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const bookedThisWeek = convList.filter(
        (c) =>
          c.status?.toLowerCase() === "booked" &&
          new Date(c.updated_at) >= weekAgo
      ).length;

      // Response rate: conversations that have at least one AI reply
      const { count: respondedCount } = await supabase
        .from("messages")
        .select("conversation_id", { count: "exact", head: true })
        .eq("role", "assistant")
        .in(
          "conversation_id",
          convList.map((c) => c.id)
        );
      const responseRate =
        totalConversations > 0
          ? Math.round(((respondedCount || 0) / totalConversations) * 100)
          : 0;

      // Avg qualify time: average minutes from created_at to updated_at
      // for conversations that progressed past "qualifying"
      const qualifiedConvos = convList.filter((c) =>
        ["interested", "booked"].includes(c.status?.toLowerCase())
      );
      let avgQualifyMinutes = 0;
      if (qualifiedConvos.length > 0) {
        const totalMinutes = qualifiedConvos.reduce((sum, c) => {
          const created = new Date(c.created_at);
          const updated = new Date(c.updated_at);
          return sum + (updated - created) / 60000;
          }, 0);
        avgQualifyMinutes = Math.round((totalMinutes / qualifiedConvos.length) * 10) / 10;
      }

      setStats({
        dmsHandled: totalConversations,
        callsBooked: booked,
        callsBookedThisWeek: bookedThisWeek,
        conversionRate: bookingRate,
        responseRate: Math.min(responseRate, 100),
        avgQualifyMinutes,
        activeConversations: active,
      });
    },
    [supabase, user?.id]
  );

  useEffect(() => {
    async function init() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser(authUser);

      const { data: userProfile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (userProfile) {
        setProfile(userProfile);
      }

      await fetchData(authUser.id);
      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("conversations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id, supabase, fetchData]);

  if (loading) return <DashboardSkeleton />;

  const igConnected = !!profile?.instagram_business_account_id;
  // Surface expired Meta tokens up here too — otherwise the coach has to
  // navigate to /settings to discover why replies stopped going out.
  const igTokenExpiresAt = profile?.meta_token_expires_at
    ? new Date(profile.meta_token_expires_at)
    : null;
  const igTokenExpired =
    igConnected && igTokenExpiresAt && igTokenExpiresAt < new Date();

  const statCards = [
    {
      title: "Calls Booked",
      value: stats.callsBooked,
      subtitle: `+${stats.callsBookedThisWeek} this week`,
      icon: CalendarCheck,
      iconBg: "bg-orange-50",
      iconColor: "text-[#ff7e67]",
    },
    {
      title: "Response Rate",
      value: `${stats.responseRate}%`,
      subtitle: `${stats.dmsHandled} conversations`,
      icon: Zap,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      title: "Avg. Qualify Time",
      value: stats.avgQualifyMinutes > 0 ? String(stats.avgQualifyMinutes) : "—",
      valueSuffix: stats.avgQualifyMinutes > 0 ? "min" : "",
      subtitle: stats.avgQualifyMinutes > 0
        ? `${stats.activeConversations} active leads`
        : "No qualified leads yet",
      icon: Clock,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-500",
    },
  ];

  return (
    <div className="space-y-8 p-8">
      {/* Warning banners */}
      {igTokenExpired && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">
              Instagram connection expired
            </p>
            <p className="text-xs text-red-600/80">
              Reconnect Instagram to resume AI replies — incoming DMs aren&apos;t
              being answered right now.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings">Reconnect</Link>
          </Button>
        </div>
      )}
      {!igConnected && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-yellow-200 bg-yellow-50">
          <Instagram className="h-5 w-5 text-yellow-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-700">
              Instagram not connected
            </p>
            <p className="text-xs text-yellow-600/70">
              Connect your Instagram so your AI can start handling DMs.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings">Connect</Link>
          </Button>
        </div>
      )}

      {profile?.subscription_status === "trialing" && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-700">
              You&apos;re on a free trial
            </p>
            <p className="text-xs text-amber-600/70">
              Subscribe to keep your AI active after your trial ends.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/billing">Upgrade</Link>
          </Button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-10 h-10 ${stat.iconBg} ${stat.iconColor} rounded-xl flex items-center justify-center`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-stone-500 uppercase tracking-tight">
                  {stat.title}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">
                  {stat.value}
                  {stat.valueSuffix && (
                    <span className="text-lg">{stat.valueSuffix}</span>
                  )}
                </span>
                <span className="text-xs font-bold text-green-500">
                  {stat.subtitle}
                </span>
              </div>
            </div>
          );
        })}

        {/* Revenue Card (brand color) */}
        <div className="bg-[#ff7e67] p-6 rounded-3xl shadow-xl shadow-[#ff7e67]/20 text-white relative overflow-hidden">
          <TrendingUp className="absolute -right-4 -top-4 h-16 w-16 opacity-10" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-sm font-bold text-white/80 uppercase tracking-tight">
              Booking Rate
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold">
              {stats.conversionRate}%
            </span>
            <span className="text-xs font-bold text-white/60">
              {stats.callsBooked} booked / {stats.dmsHandled} total
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Inbox & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Qualified Inbox */}
        <div className="lg:col-span-2 bg-white rounded-3xl soft-shadow border border-stone-100 flex flex-col">
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">Qualified Inbox</h2>
            <div className="flex gap-2">
              <span className="px-3 py-1.5 bg-stone-50 text-stone-600 rounded-xl text-xs font-bold border border-stone-200">
                {conversations.length} leads
              </span>
            </div>
          </div>

          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-stone-400">
              <Zap className="h-10 w-10 mb-3" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs mt-1">
                Conversations will appear here once your AI starts handling DMs
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {conversations.slice(0, 6).map((convo) => (
                <Link
                  key={convo.id}
                  href={`/conversations?thread=${convo.id}`}
                  className="p-5 flex items-center gap-4 hover:bg-stone-50 transition-colors cursor-pointer group"
                >
                  <Avatar className="h-12 w-12 rounded-full border-2 border-white shadow-sm">
                    <AvatarFallback className="bg-stone-100 text-stone-600 text-sm rounded-full">
                      {getInitials(convo.sender_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-extrabold text-[15px] truncate">
                        {convo.sender_name || "Unknown"}
                      </span>
                      <span className="ml-auto text-[11px] font-medium text-stone-400">
                        {relativeTime(convo.last_message_at)}
                      </span>
                    </div>
                    <p className="text-sm text-stone-600 truncate">
                      {convo.last_message_role === "assistant" && (
                        <span className="font-bold text-[#ff7e67]">AI: </span>
                      )}
                      {convo.last_message
                        ? convo.last_message.length > 70
                          ? convo.last_message.slice(0, 70) + "..."
                          : convo.last_message
                        : "No messages yet"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={convo.status} />
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:text-[#ff7e67] shadow-sm">
                        <Eye className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {conversations.length > 6 && (
            <div className="p-4 border-t border-stone-100 text-center">
              <Link
                href="/conversations"
                className="text-stone-400 text-xs font-bold hover:text-stone-600 transition-all uppercase tracking-widest"
              >
                View All {conversations.length} Leads
              </Link>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Upcoming Calls */}
          <div className="bg-white p-6 rounded-3xl soft-shadow border border-stone-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-extrabold">Upcoming Calls</h3>
              {profile?.calendly_url && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
                  CALENDLY SYNCED
                </div>
              )}
            </div>
            <div className="space-y-4">
              {conversations
                .filter((c) => c.status?.toLowerCase() === "booked")
                .slice(0, 3)
                .map((convo) => (
                  <div
                    key={convo.id}
                    className="flex items-center gap-4 p-3 rounded-2xl bg-stone-50 border border-stone-100"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex flex-col items-center justify-center shadow-sm border border-stone-100">
                      <span className="text-[10px] font-bold text-stone-400 uppercase">
                        {new Date(convo.updated_at).toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="text-sm font-extrabold leading-none">
                        {new Date(convo.updated_at).getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold">
                        {convo.sender_name || "Unknown"}
                      </p>
                      <p className="text-[11px] text-stone-500">Discovery Call</p>
                    </div>
                    <ExternalLink className="ml-auto h-4 w-4 text-stone-300" />
                  </div>
                ))}
              {conversations.filter((c) => c.status?.toLowerCase() === "booked").length === 0 && (
                <p className="text-sm text-stone-400 text-center py-4">
                  No upcoming calls
                </p>
              )}
            </div>
            <Link
              href="/calendar"
              className="block w-full mt-6 py-3 border-2 border-stone-100 rounded-2xl text-xs font-bold text-stone-500 hover:border-[#ff7e67] hover:text-[#ff7e67] transition-all text-center"
            >
              View Full Calendar
            </Link>
          </div>

          {/* Script Performance */}
          <div className="bg-[#fff5f2] p-6 rounded-3xl border border-[#ff7e67]/20">
            <h3 className="text-lg font-extrabold mb-4">Script Performance</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span>Qualification Rate</span>
                  <span className="text-[#ff7e67]">
                    {stats.dmsHandled > 0
                      ? Math.round(
                          ((stats.activeConversations + stats.callsBooked) /
                            stats.dmsHandled) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#ff7e67]"
                    style={{
                      width: `${
                        stats.dmsHandled > 0
                          ? Math.round(
                              ((stats.activeConversations + stats.callsBooked) /
                                stats.dmsHandled) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span>Booking Rate</span>
                  <span className="text-[#ff7e67]">{stats.conversionRate}%</span>
                </div>
                <div className="h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#ff7e67]"
                    style={{ width: `${stats.conversionRate}%` }}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <div className="flex-1 bg-white p-3 rounded-2xl shadow-sm border border-[#ff7e67]/10">
                  <p className="text-[10px] font-bold text-stone-400 uppercase">
                    Total DMs
                  </p>
                  <p className="text-xl font-extrabold">{stats.dmsHandled}</p>
                </div>
                <div className="flex-1 bg-white p-3 rounded-2xl shadow-sm border border-[#ff7e67]/10">
                  <p className="text-[10px] font-bold text-stone-400 uppercase">
                    Active Leads
                  </p>
                  <p className="text-xl font-extrabold">
                    {stats.activeConversations}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
