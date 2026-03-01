"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MessageSquare,
  Calendar,
  TrendingUp,
  Users,
  Loader2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";

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

function statusVariant(status) {
  switch (status?.toLowerCase()) {
    case "qualifying":
    case "interested":
      return "warning";
    case "booked":
      return "success";
    case "not a fit":
    case "not_a_fit":
      return "muted";
    default:
      return "default";
  }
}

function statusLabel(status) {
  switch (status?.toLowerCase()) {
    case "qualifying":
      return "Qualifying";
    case "interested":
      return "Interested";
    case "booked":
      return "Booked";
    case "not a fit":
    case "not_a_fit":
      return "Not a Fit";
    default:
      return status || "New";
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
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

      // Fix 8: Join messages to derive last_message since the column doesn't exist
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

      // Calculate stats
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

      // Fetch AI active status
      const { data: profile } = await supabase
        .from("users")
        .select("ai_active")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        setAiActive(profile.ai_active ?? false);
      }

      await fetchData(authUser.id);
      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
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
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleJumpIn = async (conversation) => {
    await supabase
      .from("conversations")
      .update({ ai_paused: true, status: "manual" })
      .eq("id", conversation.id);

    router.push(`/conversations?thread=${conversation.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <CardHeader>
          <CardTitle>Recent Conversations</CardTitle>
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
              {conversations.map((convo, index) => (
                <div key={convo.id}>
                  {index > 0 && <Separator />}
                  <div className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors">
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
                          <Badge variant={statusVariant(convo.status)}>
                            {statusLabel(convo.status)}
                          </Badge>
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
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(convo.updated_at)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleJumpIn(convo)}
                      >
                        Jump In
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
