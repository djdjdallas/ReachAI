"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  MessageSquare,
  Calendar,
  TrendingUp,
  Users,
  Zap,
  AlertTriangle,
  Instagram,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/app/StatusBadge";

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [aiActive, setAiActive] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [stats, setStats] = useState({
    dmsHandled: 0,
    callsBooked: 0,
    conversionRate: 0,
    activeConversations: 0,
  });
  const [conversations, setConversations] = useState([]);

  const fetchData = useCallback(
    async (userId) => {
      const uid = userId || user?.id;
      if (!uid) return;

      const { data: convos } = await supabase
        .from("conversations")
        .select("*, messages(content, created_at)")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(20);

      const convList = (convos || []).map((convo) => {
        const sorted = (convo.messages || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        return {
          ...convo,
          last_message: sorted[0]?.content || null,
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
      const rate =
        totalConversations > 0
          ? Math.round((booked / totalConversations) * 100)
          : 0;

      setStats({
        dmsHandled: totalConversations,
        callsBooked: booked,
        conversionRate: rate,
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
        setAiActive(userProfile.ai_active ?? false);
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

  const handleToggleAi = async (checked) => {
    setTogglingAi(true);
    setAiActive(checked);
    await supabase
      .from("users")
      .update({ ai_active: checked })
      .eq("id", user.id);
    setTogglingAi(false);
  };

  if (loading) return <DashboardSkeleton />;

  const dmCount = profile?.dm_count_this_month || 0;
  const dmLimit = profile?.plan === "unlimited" ? null : 500;
  const dmPercent = dmLimit ? Math.min((dmCount / dmLimit) * 100, 100) : 0;
  const igConnected = !!profile?.unipile_account_id;

  const statCards = [
    {
      title: "DMs Handled",
      value: stats.dmsHandled,
      subtitle: "Total conversations",
      icon: MessageSquare,
    },
    {
      title: "Calls Booked",
      value: stats.callsBooked,
      subtitle: "Qualified leads booked",
      icon: Calendar,
    },
    {
      title: "Conversion Rate",
      value: `${stats.conversionRate}%`,
      subtitle: "DMs to booked calls",
      icon: TrendingUp,
    },
    {
      title: "Active Conversations",
      value: stats.activeConversations,
      subtitle: "Currently qualifying",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Warning banners */}
      {!igConnected && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
          <Instagram className="h-5 w-5 text-yellow-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              Instagram not connected
            </p>
            <p className="text-xs text-muted-foreground">
              Connect your Instagram to start handling DMs automatically.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings">Connect</Link>
          </Button>
        </div>
      )}

      {profile?.subscription_status === "trialing" && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              You&apos;re on a free trial
            </p>
            <p className="text-xs text-muted-foreground">
              Subscribe to keep your AI active after your trial ends.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/billing">Upgrade</Link>
          </Button>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.subtitle}
                </p>
              </CardContent>
            </Card>
          );
        })}

        {/* DMs This Month card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              DMs This Month
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dmCount}
              {dmLimit && (
                <span className="text-sm font-normal text-muted-foreground">
                  /{dmLimit}
                </span>
              )}
            </div>
            {dmLimit ? (
              <Progress value={dmPercent} className="h-2 mt-2" />
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Unlimited</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Status Toggle */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                aiActive
                  ? "bg-green-500/15 text-green-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">AI Agent Status</CardTitle>
              <p className="text-sm text-muted-foreground">
                {aiActive
                  ? "AI is actively handling new DMs"
                  : "AI is paused — new DMs will not be handled"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-medium ${
                aiActive ? "text-green-600" : "text-muted-foreground"
              }`}
            >
              {aiActive ? "Active" : "Paused"}
            </span>
            <Switch
              checked={aiActive}
              onCheckedChange={handleToggleAi}
              disabled={togglingAi}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Recent Conversations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Conversations</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/conversations">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mb-3" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">
                Conversations will appear here once your AI starts handling DMs
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              {conversations.slice(0, 10).map((convo, index) => (
                <div key={convo.id}>
                  {index > 0 && <Separator />}
                  <Link
                    href={`/conversations?thread=${convo.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs">
                          {getInitials(convo.sender_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {convo.sender_name || "Unknown"}
                          </span>
                          <StatusBadge status={convo.status} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {convo.last_message
                            ? convo.last_message.length > 80
                              ? convo.last_message.slice(0, 80) + "..."
                              : convo.last_message
                            : "No messages yet"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {timeAgo(convo.updated_at)}
                    </span>
                  </Link>
                </div>
              ))}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
