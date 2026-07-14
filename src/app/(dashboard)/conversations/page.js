"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import posthog from "posthog-js";
import {
  MessageSquare,
  Send,
  Loader2,
  Search,
  Bot,
  User,
  CheckCircle,
  ChevronLeft,
  Info,
  MoreVertical,
  Smile,
  Paperclip,
  Sparkles,
  Trash2,
  AlertCircle,
  Plus,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import StatusBadge from "@/components/app/StatusBadge";
import { parseTimestamp, relativeTime, calendarLabel, localDayKey } from "@/lib/dates";

// Banner rendered at the top of a thread flagged missing_outbound_context —
// surfaces a paste-the-original-DM CTA so the AI can be backfilled with full
// context. On save, calls /api/native-send/backfill which links the new row
// to this conversation; realtime subscription on conversations then refreshes
// selectedConvo and this banner unmounts naturally.
function BackfillBanner({ conversation }) {
  const [dmText, setDmText] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  async function handleSave() {
    if (!dmText.trim() || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/native-send/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          dm_text: dmText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to save.");
        return;
      }
      // Don't reset dmText — realtime will unmount this banner via the
      // missing_outbound_context flag clearing. If the realtime sub is slow,
      // showing the saved text briefly is better than a blank field flash.
    } catch (err) {
      setErrorMsg(err.message || "Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-3 border-b border-stone-100 bg-amber-50">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-2">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-bold">Backfill needed: </span>
            did you send this lead a DM from native Instagram? Paste it here so
            the AI has full context for this conversation.
          </p>
          <Textarea
            value={dmText}
            onChange={(e) => setDmText(e.target.value)}
            placeholder="Paste the exact DM you sent."
            rows={3}
            disabled={saving}
            className="bg-white border-amber-200 focus-visible:ring-amber-400"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-amber-700">
              {errorMsg ? errorMsg : "Saving links the DM to this thread so the AI's next reply has both turns."}
            </p>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !dmText.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "needs_review", label: "Needs Review" },
  { value: "qualifying", label: "Qualifying" },
  { value: "interested", label: "Interested" },
  { value: "booked", label: "Booked" },
  { value: "not_a_fit", label: "Not a Fit" },
  { value: "manual", label: "Human Takeover" },
];

const SMART_REPLIES = [
  {
    type: "objection",
    label: "HANDLE OBJECTION",
    text: "Yeah that makes sense honestly. What's the main thing holding you back? Just want to make sure I can help.",
  },
  {
    type: "book",
    label: "BOOK CALL",
    text: "Sounds like this could be a good fit for you. Want to hop on a quick call so I can walk you through everything?",
  },
  {
    type: "reengage",
    label: "RE-ENGAGE",
    text: "Hey! Just circling back. Did you get a chance to think things over? No rush, just didn't want you to miss out.",
  },
];

export default function ConversationsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        </div>
      }
    >
      <ConversationsPage />
    </Suspense>
  );
}

function ConversationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const messagesEndRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [summarizing, setSummarizing] = useState(false);
  const [scheduledDrip, setScheduledDrip] = useState(null);
  const [cancelingDrip, setCancelingDrip] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchConversations = useCallback(
    async (userId) => {
      const uid = userId || user?.id;
      if (!uid) return;

      const { data: convos } = await supabase
        .from("conversations")
        .select("*, messages(content, created_at)")
        .eq("user_id", uid)
        .order("last_message_at", { ascending: false });

      const mapped = (convos || []).map((convo) => {
        const sorted = (convo.messages || []).sort(
          (a, b) => parseTimestamp(b.created_at) - parseTimestamp(a.created_at)
        );
        return {
          ...convo,
          last_message: sorted[0]?.content || null,
          messages: undefined,
        };
      });
      setConversations(mapped);
    },
    [supabase, user?.id]
  );

  const fetchMessages = useCallback(
    async (conversationId) => {
      if (!conversationId) return;
      setMessagesLoading(true);
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      setMessages(msgs || []);
      setMessagesLoading(false);
      setTimeout(() => scrollToBottom(), 100);
    },
    [supabase, scrollToBottom]
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
        .select("ai_mode")
        .eq("id", authUser.id)
        .single();
      if (userProfile) setProfile(userProfile);

      const { data: convos } = await supabase
        .from("conversations")
        .select("*, messages(content, created_at)")
        .eq("user_id", authUser.id)
        .order("last_message_at", { ascending: false });

      const convoList = (convos || []).map((convo) => {
        const sorted = (convo.messages || []).sort(
          (a, b) => parseTimestamp(b.created_at) - parseTimestamp(a.created_at)
        );
        return {
          ...convo,
          last_message: sorted[0]?.content || null,
          messages: undefined,
        };
      });
      setConversations(convoList);

      const threadId = searchParams.get("thread");
      if (threadId) {
        const match = convoList.find((c) => c.id === threadId);
        if (match) setSelectedConvo(match);
      }

      setLoading(false);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedConvo?.id) {
      fetchMessages(selectedConvo.id);
    } else {
      setMessages([]);
    }
  }, [selectedConvo?.id, fetchMessages]);

  // Load any scheduled follow-up nudge for the selected conversation so we can
  // render the "Follow-up scheduled in X hours" badge. Silently no-ops for
  // non-Unlimited accounts (the endpoint 403s and we just show nothing).
  useEffect(() => {
    let canceled = false;
    if (!selectedConvo?.id) {
      setScheduledDrip(null);
      return;
    }
    fetch(`/api/drip-queue/conversation/${selectedConvo.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!canceled) setScheduledDrip(data?.drip || null);
      })
      .catch(() => {
        if (!canceled) setScheduledDrip(null);
      });
    return () => {
      canceled = true;
    };
  }, [selectedConvo?.id]);

  const handleCancelDrip = async () => {
    if (!selectedConvo || cancelingDrip) return;
    setCancelingDrip(true);
    // Optimistic clear.
    const prev = scheduledDrip;
    setScheduledDrip(null);
    try {
      const res = await fetch(`/api/drip-queue/conversation/${selectedConvo.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setScheduledDrip(prev);
        return;
      }
      posthog.capture("drip_canceled_manual", { conversation_id: selectedConvo.id });
    } catch {
      setScheduledDrip(prev);
    } finally {
      setCancelingDrip(false);
    }
  };

  function dripHoursFromNow(scheduledAt) {
    if (!scheduledAt) return null;
    const ms = new Date(scheduledAt).getTime() - Date.now();
    if (ms <= 0) return "soon";
    const hours = Math.round(ms / (1000 * 60 * 60));
    return hours <= 1 ? "under 1h" : `${hours}h`;
  }

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
        (payload) => {
          fetchConversations();
          if (
            payload.new &&
            selectedConvo &&
            payload.new.id === selectedConvo.id
          ) {
            setSelectedConvo(payload.new);
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id, supabase, fetchConversations, selectedConvo]);

  useEffect(() => {
    if (!selectedConvo?.id) return;
    const channel = supabase
      .channel(`messages-${selectedConvo.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConvo.id}`,
        },
        () => fetchMessages(selectedConvo.id)
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedConvo?.id, supabase, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSelectConversation = (convo) => {
    setSelectedConvo(convo);
    setNewMessage("");
    router.replace(`/conversations?thread=${convo.id}`, { scroll: false });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvo || sending) return;

    const messageText = newMessage.trim();
    setSending(true);
    setNewMessage("");

    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConvo.id,
      role: "assistant",
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom(), 50);

    try {
      const res = await fetch("/api/ai/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConvo.id,
          message: messageText,
          manual: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      await fetchMessages(selectedConvo.id);
      posthog.capture("manual_message_sent", {
        conversation_id: selectedConvo.id,
        message_length: messageText.length,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      posthog.capture("message_send_failed", {
        conversation_id: selectedConvo.id,
        error: error.message,
      });
      setMessages((prev) =>
        prev.filter((m) => m.id !== optimisticMessage.id)
      );
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const handleResumeAi = async () => {
    if (!selectedConvo) return;
    await supabase
      .from("conversations")
      .update({ ai_paused: false, ai_pause_reason: null, status: "qualifying" })
      .eq("id", selectedConvo.id);
    setSelectedConvo((prev) => ({
      ...prev,
      ai_paused: false,
      ai_pause_reason: null,
      status: "qualifying",
    }));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConvo.id
          ? { ...c, ai_paused: false, ai_pause_reason: null, status: "qualifying" }
          : c
      )
    );
    posthog.capture("ai_resumed", { conversation_id: selectedConvo.id });
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedConvo) return;
    await supabase
      .from("conversations")
      .update({ status: newStatus })
      .eq("id", selectedConvo.id);
    setSelectedConvo((prev) => ({ ...prev, status: newStatus }));
    posthog.capture("lead_status_changed", {
      conversation_id: selectedConvo.id,
      from_status: selectedConvo.status,
      to_status: newStatus,
      source: "manual",
    });

    if (newStatus === "booked") {
      await supabase.from("bookings").insert({
        user_id: user.id,
        conversation_id: selectedConvo.id,
      });
    }

    // A terminal status means no follow-up nudge should fire — cancel any
    // scheduled one. Best-effort; the drip processor also re-checks status at
    // fire time, so this is a fast-path UX cancel, not the only guard.
    if (newStatus === "booked" || newStatus === "not_a_fit") {
      fetch(`/api/drip-queue/conversation/${selectedConvo.id}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  };

  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachUsername, setOutreachUsername] = useState("");
  const [outreachMessage, setOutreachMessage] = useState("");
  const [outreachSending, setOutreachSending] = useState(false);
  const [outreachError, setOutreachError] = useState(null);

  const handleStartOutreach = async (e) => {
    e.preventDefault();
    if (outreachSending) return;
    const username = outreachUsername.trim();
    const message = outreachMessage.trim();
    if (!username || !message) return;

    setOutreachSending(true);
    setOutreachError(null);
    try {
      const res = await fetch("/api/outreach/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOutreachError(data.error || "Failed to start outreach.");
        posthog.capture("outreach_start_failed", {
          status: res.status,
          reason: data.reason || null,
        });
        return;
      }
      posthog.capture("outreach_started_client", {
        conversation_id: data.conversationId,
        delivery_ok: data.delivery_ok !== false,
      });
      setOutreachOpen(false);
      setOutreachUsername("");
      setOutreachMessage("");
      await fetchConversations(user?.id);
      if (data.conversationId) {
        router.replace(`/conversations?thread=${data.conversationId}`, {
          scroll: false,
        });
      }
    } catch (err) {
      setOutreachError(err.message || "Network error.");
    } finally {
      setOutreachSending(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConvo || deleting) return;

    setDeleting(true);
    try {
      // Delete messages first (foreign key constraint)
      await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", selectedConvo.id);

      // Delete the conversation
      await supabase
        .from("conversations")
        .delete()
        .eq("id", selectedConvo.id);

      // Update local state
      setConversations((prev) => prev.filter((c) => c.id !== selectedConvo.id));
      posthog.capture("conversation_deleted", { conversation_id: selectedConvo.id });
      setSelectedConvo(null);
      setMessages([]);
      setConfirmDeleteOpen(false);
      router.replace("/conversations", { scroll: false });
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    } finally {
      setDeleting(false);
    }
  };

  const [aiModeError, setAiModeError] = useState(null);

  const handleSetAiMode = async (mode) => {
    setAiModeError(null);
    try {
      const res = await fetch("/api/users/ai-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiModeError(data?.error || "Failed to update agent mode.");
        return;
      }

      // TODO(post-launch): Remove after one release cycle. This branch
      // was previously written to mop up invisible manual-reply pauses
      // (ai_paused=true with null reason). That code path was removed
      // in <commit-sha>. Kept temporarily as defensive cleanup for any
      // legacy rows that escape the one-shot SQL migration.
      if (mode === "active") {
        await supabase
          .from("conversations")
          .update({ ai_paused: false, ai_pause_reason: null })
          .eq("user_id", user.id)
          .eq("ai_paused", true)
          .is("ai_pause_reason", null);
        setConversations((prev) =>
          prev.map((c) =>
            c.ai_paused && !c.ai_pause_reason
              ? { ...c, ai_paused: false, ai_pause_reason: null }
              : c
          )
        );
        setSelectedConvo((prev) =>
          prev && prev.ai_paused && !prev.ai_pause_reason
            ? { ...prev, ai_paused: false, ai_pause_reason: null }
            : prev
        );
      }

      setProfile((prev) => ({ ...prev, ai_mode: mode }));
    } catch (err) {
      console.error("Failed to set AI mode:", err);
      setAiModeError("Failed to update agent mode.");
    }
  };

  const handleSummarize = async () => {
    if (!selectedConvo || summarizing) return;
    setSummarizing(true);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedConvo.id }),
      });
      const data = await res.json();
      if (data.summary) {
        setSelectedConvo((prev) => ({
          ...prev,
          ai_summary: data.summary,
          lead_temperature: data.temperature,
        }));
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConvo.id
              ? { ...c, ai_summary: data.summary, lead_temperature: data.temperature }
              : c
          )
        );
        posthog.capture("conversation_summarized", {
          conversation_id: selectedConvo.id,
          lead_temperature: data.temperature,
        });
      }
    } catch (err) {
      console.error("Failed to summarize:", err);
    } finally {
      setSummarizing(false);
    }
  };

  const tempColors = {
    hot: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", label: "HOT LEAD" },
    warm: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", label: "WARM LEAD" },
    cold: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", label: "COLD LEAD" },
  };

  const filteredConversations = conversations.filter((convo) => {
    const matchesSearch =
      !searchQuery.trim() ||
      convo.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      convo.last_message?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStatus;
    if (statusFilter === "all") {
      matchesStatus = true;
    } else if (statusFilter === "needs_review") {
      matchesStatus =
        convo.ai_paused === true && convo.ai_pause_reason === "complex_objection";
    } else {
      matchesStatus = convo.status?.toLowerCase() === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="w-[380px] border-r border-stone-200 flex flex-col p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="h-12 w-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel: Conversation List */}
      <div className="w-full md:w-[380px] border-r border-stone-200 flex flex-col bg-white">
        <div className="px-5 pt-5 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-xl tracking-tight">Conversations</h2>
            <Tabs value={profile?.ai_mode || "active"} onValueChange={handleSetAiMode}>
              <TabsList className="h-8">
                <TabsTrigger
                  value="active"
                  className="text-[11px] px-2.5 data-[state=active]:bg-green-100 data-[state=active]:text-green-700"
                >
                  Active
                </TabsTrigger>
                <TabsTrigger
                  value="handoff"
                  className="text-[11px] px-2.5 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700"
                >
                  Handoff
                </TabsTrigger>
                <TabsTrigger
                  value="off"
                  className="text-[11px] px-2.5 data-[state=active]:bg-red-100 data-[state=active]:text-red-700"
                >
                  Off
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setOutreachError(null);
              setOutreachOpen(true);
            }}
            className="w-full gap-1.5 border-stone-200 hover:bg-stone-50"
          >
            <Plus className="h-3.5 w-3.5" />
            New outreach
          </Button>
          {aiModeError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{aiModeError}</span>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-stone-50 border-stone-200 focus-visible:border-[#ff7e67] h-9"
            />
          </div>
          {/* Status filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  statusFilter === filter.value
                    ? "bg-[#ff7e67] text-white shadow-sm shadow-[#ff7e67]/25"
                    : "bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-stone-100" />

        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-stone-400">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">
                {searchQuery || statusFilter !== "all"
                  ? "No conversations found"
                  : "No conversations yet"}
              </p>
              <p className="text-xs text-stone-400/60 mt-1">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Conversations will appear here"}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filteredConversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => handleSelectConversation(convo)}
                  className={`w-full text-left px-4 py-3 transition-colors relative ${
                    selectedConvo?.id === convo.id
                      ? "bg-[#fff5f2]"
                      : "hover:bg-stone-50"
                  }`}
                >
                  {selectedConvo?.id === convo.id && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#ff7e67]" />
                  )}
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0 mt-0.5">
                      <AvatarFallback className="text-xs bg-stone-100 text-stone-600">
                        {getInitials(convo.sender_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {convo.sender_name || "Unknown"}
                        </span>
                        <span className="text-[11px] text-stone-400 whitespace-nowrap shrink-0">
                          {relativeTime(convo.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={convo.status} />
                        {convo.ai_paused &&
                          convo.ai_pause_reason === "complex_objection" && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-50 text-red-600 border border-red-200">
                              Needs Review
                            </span>
                          )}
                        {convo.ai_paused &&
                          convo.ai_pause_reason === "qualifying_loop_detected" && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                              Paused — Loop
                            </span>
                          )}
                        {convo.lead_temperature && tempColors[convo.lead_temperature] && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${tempColors[convo.lead_temperature].bg} ${tempColors[convo.lead_temperature].text}`}>
                            {tempColors[convo.lead_temperature].label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 truncate mt-1.5 leading-relaxed">
                        {convo.last_message
                          ? convo.last_message.length > 60
                            ? convo.last_message.slice(0, 60) + "..."
                            : convo.last_message
                          : "No messages yet"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel: Message Thread */}
      <div className={`flex-1 flex flex-col bg-white ${selectedConvo ? "" : "hidden md:flex"}`}>
        {selectedConvo ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  className="md:hidden w-10 h-10 flex items-center justify-center text-stone-400 hover:text-stone-900"
                  onClick={() => setSelectedConvo(null)}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-full border border-stone-100">
                    <AvatarFallback className="bg-stone-100 text-stone-600 text-sm">
                      {getInitials(selectedConvo.sender_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold">
                        {selectedConvo.sender_name || "Unknown"}
                      </h2>
                      <StatusBadge status={selectedConvo.status} />
                    </div>
                    <p className="text-[11px] font-medium text-stone-500">
                      Activity: {relativeTime(selectedConvo.last_message_at)}
                    </p>
                    {scheduledDrip && scheduledDrip.status === "scheduled" && (
                      <div className="mt-1 inline-flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#fff5f2] text-[#ff7e67] border border-[#ff7e67]/20">
                          <Send className="h-2.5 w-2.5" />
                          Follow-up in {dripHoursFromNow(scheduledDrip.scheduled_at)}
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelDrip}
                          disabled={cancelingDrip}
                          className="text-[10px] font-medium text-stone-400 hover:text-stone-600 underline underline-offset-2 disabled:opacity-50"
                        >
                          Cancel follow-up
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedConvo.status !== "booked" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("booked")}
                    className="gap-1.5 border-stone-200 hover:bg-stone-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Mark Booked
                  </Button>
                )}
                {selectedConvo.ai_paused && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResumeAi}
                    className="gap-1.5 border-stone-200 hover:bg-stone-50"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    Resume AI
                  </Button>
                )}
                <Select
                  value={selectedConvo.status || "qualifying"}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger className="h-8 text-xs w-auto border-stone-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualifying">Qualifying</SelectItem>
                    <SelectItem value="interested">Interested</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="not_a_fit">Not a Fit</SelectItem>
                    <SelectItem value="manual">Human Takeover</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleting}
                  className="gap-1.5 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete
                </Button>
              </div>
            </div>

            {/* Complex-objection (human-in-loop) banner */}
            {selectedConvo.ai_paused &&
              selectedConvo.ai_pause_reason === "complex_objection" && (
                <div className="px-6 py-3 border-b border-stone-100 bg-red-50">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700 leading-relaxed">
                      <span className="font-bold">AI paused:</span> complex
                      objection detected. Review the conversation and respond
                      manually, then click Resume AI when ready.
                    </p>
                  </div>
                </div>
              )}

            {/* Qualifying-loop banner */}
            {selectedConvo.ai_paused &&
              selectedConvo.ai_pause_reason === "qualifying_loop_detected" && (
                <div className="px-6 py-3 border-b border-stone-100 bg-amber-50">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      <span className="font-bold">Paused — </span>
                      conversation wasn&apos;t progressing. Take over manually
                      to redirect.
                    </p>
                  </div>
                </div>
              )}

            {/* Native-send backfill banner */}
            {selectedConvo.missing_outbound_context && (
              <BackfillBanner conversation={selectedConvo} />
            )}

            {/* Summary Panel */}
            <div className="px-6 py-3 border-b border-stone-100 flex items-center gap-3">
              {selectedConvo.lead_temperature && tempColors[selectedConvo.lead_temperature] ? (
                <div className={`flex-1 flex items-start gap-3 p-3 rounded-xl ${tempColors[selectedConvo.lead_temperature].bg} border ${tempColors[selectedConvo.lead_temperature].border}`}>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${tempColors[selectedConvo.lead_temperature].text} bg-white/80`}>
                    {tempColors[selectedConvo.lead_temperature].label}
                  </span>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {selectedConvo.ai_summary}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSummarize}
                    disabled={summarizing}
                    className="shrink-0 text-stone-400 hover:text-stone-600"
                  >
                    {summarizing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSummarize}
                  disabled={summarizing || messages.length === 0}
                  className="gap-1.5"
                >
                  {summarizing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {summarizing ? "Analyzing..." : "Generate Summary"}
                </Button>
              )}
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 px-6 py-4">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        i % 2 === 0 ? "justify-start" : "justify-end"
                      }`}
                    >
                      <Skeleton className="h-12 w-48 rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-stone-400">
                  <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs text-stone-400/60 mt-1">
                    Messages will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {(() => {
                    // Track the local calendar day of the previous message so a
                    // date separator is rendered only when the day changes. The
                    // label reflects each message's own created_at — old
                    // messages can no longer fall under a hardcoded "Today".
                    let prevDayKey = null;
                    return messages.map((msg) => {
                    const dayKey = localDayKey(msg.created_at);
                    const showDateDivider = dayKey !== prevDayKey;
                    prevDayKey = dayKey;
                    const isOutbound = msg.role === "assistant";
                    // Resolve label: prefer the new `source` column. Fall back
                    // to `role` for legacy rows where `source` is null —
                    // pre-migration manual replies will render as "AI".
                    const isManualReply = msg.source === "manual";
                    const isNativeSend = msg.source === "native_send";
                    const isDrip = msg.source === "drip";
                    const outboundLabel = isManualReply
                      ? "You"
                      : isNativeSend
                        ? "Sent from IG mobile"
                        : isDrip
                          ? "Follow-up nudge"
                          : "AI";
                    const OutboundIcon = isManualReply
                      ? User
                      : isNativeSend
                        ? Smartphone
                        : isDrip
                          ? Send
                          : Bot;
                    return (
                      <div key={msg.id} className="space-y-6">
                        {showDateDivider && (
                          <div className="flex justify-center">
                            <span className="px-3 py-1 bg-stone-50 rounded-full text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                              {calendarLabel(msg.created_at)}
                            </span>
                          </div>
                        )}
                        {isOutbound ? (
                          <div className="flex items-end gap-3 justify-end ml-auto max-w-[80%]">
                            <div className="space-y-1 text-right">
                              <div
                                className={`px-4 py-3 text-sm leading-relaxed ${
                                  isManualReply
                                    ? "bg-stone-700 text-white"
                                    : "bg-[#ff7e67] text-white"
                                }`}
                                style={{ borderRadius: "18px 18px 4px 18px" }}
                              >
                                <p className="whitespace-pre-wrap">
                                  {msg.content}
                                </p>
                              </div>
                              <div className="flex items-center justify-end gap-1.5 px-1">
                                <span className="text-[10px] font-medium text-stone-400 flex items-center gap-0.5">
                                  <OutboundIcon className="h-2.5 w-2.5" />
                                  {outboundLabel}
                                </span>
                                <span className="text-[10px] text-stone-400">
                                  {relativeTime(msg.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-end gap-3 max-w-[80%]">
                            <Avatar className="h-8 w-8 rounded-full mb-1 shrink-0">
                              <AvatarFallback className="text-[10px] bg-stone-100 text-stone-600">
                                {getInitials(selectedConvo.sender_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                              <div className="bg-stone-100 px-4 py-3 text-sm leading-relaxed text-stone-700"
                                style={{ borderRadius: "18px 18px 18px 4px" }}>
                                <p className="whitespace-pre-wrap">
                                  {msg.content}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 px-1">
                                <span className="text-[10px] font-medium text-stone-400">
                                  {selectedConvo.sender_name || "Lead"}
                                </span>
                                <span className="text-[10px] text-stone-400">·</span>
                                <span className="text-[10px] text-stone-400">
                                  {relativeTime(msg.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                    });
                  })()}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* AI Smart Replies */}
            <div className="px-6 py-4 border-t border-stone-100 bg-[#fafaf9]/50">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-[#ff7e67]" />
                <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">
                  AI Smart Replies
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {SMART_REPLIES.map((reply) => (
                  <button
                    key={reply.type}
                    onClick={() => {
                      setNewMessage(reply.text);
                      posthog.capture("smart_reply_used", {
                        reply_type: reply.type,
                        conversation_id: selectedConvo?.id,
                      });
                    }}
                    className="group p-3 bg-white border border-stone-200 rounded-xl text-left hover:border-[#ff7e67] hover:shadow-sm transition-all"
                  >
                    <div className="text-[10px] font-bold text-stone-400 mb-1 group-hover:text-[#ff7e67]">
                      {reply.label}
                    </div>
                    <p className="text-xs text-stone-600 line-clamp-2 italic leading-relaxed">
                      &quot;{reply.text.slice(0, 80)}...&quot;
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className="p-6 border-t border-stone-100 flex items-center gap-4">
              <div className="flex-1 relative">
                <form onSubmit={handleSendMessage} className="flex items-center gap-4">
                  <input
                    type="text"
                    placeholder="Type a message or use AI suggestions..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sending}
                    className="w-full px-5 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7e67]/20 focus:border-[#ff7e67] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="w-12 h-12 bg-[#ff7e67] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#ff7e67]/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-5">
              <MessageSquare className="h-7 w-7 text-stone-400/50" />
            </div>
            <h3 className="text-lg font-medium mb-1.5 text-stone-600">
              No conversation selected
            </h3>
            <p className="text-sm text-stone-400">
              Choose a conversation from the list to view messages
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this conversation?"
        description="This will permanently delete the conversation and all its messages. This cannot be undone."
        confirmText="Delete"
        loading={deleting}
        onConfirm={handleDeleteConversation}
      />

      <Dialog open={outreachOpen} onOpenChange={setOutreachOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New outreach DM</DialogTitle>
            <DialogDescription>
              Sends from your connected Instagram business account and marks
              the thread as outreach-initiated so the agent can take over the
              reply once they respond.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStartOutreach} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">
                Instagram username
              </label>
              <Input
                placeholder="@username or paste IGSID"
                value={outreachUsername}
                onChange={(e) => setOutreachUsername(e.target.value)}
                disabled={outreachSending}
                autoFocus
              />
              <p className="text-[11px] text-stone-400 leading-relaxed">
                Username lookup uses Business Discovery and only resolves
                public business or creator accounts. For personal accounts,
                paste the recipient&apos;s IGSID.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">
                First message
              </label>
              <textarea
                placeholder="Hey, saw your..."
                value={outreachMessage}
                onChange={(e) => setOutreachMessage(e.target.value)}
                disabled={outreachSending}
                rows={4}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7e67]/20 focus:border-[#ff7e67] transition-all resize-none"
              />
            </div>
            {outreachError && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{outreachError}</span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOutreachOpen(false)}
                disabled={outreachSending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  outreachSending ||
                  !outreachUsername.trim() ||
                  !outreachMessage.trim()
                }
                className="gap-1.5 bg-[#ff7e67] hover:bg-[#ff7e67]/90 text-white"
              >
                {outreachSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send outreach
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
