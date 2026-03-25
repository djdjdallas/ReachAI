"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MessageSquare,
  Send,
  Loader2,
  Search,
  Bot,
  User,
  CheckCircle,
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "qualifying", label: "Qualifying" },
  { value: "interested", label: "Interested" },
  { value: "booked", label: "Booked" },
  { value: "not_a_fit", label: "Not a Fit" },
  { value: "manual", label: "Human Takeover" },
];

export default function ConversationsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
        .order("updated_at", { ascending: false });

      const mapped = (convos || []).map((convo) => {
        const sorted = (convo.messages || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
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

      const { data: convos } = await supabase
        .from("conversations")
        .select("*, messages(content, created_at)")
        .eq("user_id", authUser.id)
        .order("updated_at", { ascending: false });

      const convoList = (convos || []).map((convo) => {
        const sorted = (convo.messages || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
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
    } catch (error) {
      console.error("Failed to send message:", error);
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
      .update({ ai_paused: false, status: "qualifying" })
      .eq("id", selectedConvo.id);
    setSelectedConvo((prev) => ({
      ...prev,
      ai_paused: false,
      status: "qualifying",
    }));
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedConvo) return;
    await supabase
      .from("conversations")
      .update({ status: newStatus })
      .eq("id", selectedConvo.id);
    setSelectedConvo((prev) => ({ ...prev, status: newStatus }));

    if (newStatus === "booked") {
      await supabase.from("bookings").insert({
        user_id: user.id,
        conversation_id: selectedConvo.id,
      });
    }
  };

  const filteredConversations = conversations.filter((convo) => {
    const matchesSearch =
      !searchQuery.trim() ||
      convo.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      convo.last_message?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      convo.status?.toLowerCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="w-[380px] border-r border-white/[0.06] flex flex-col p-4 space-y-4">
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
    <div className="flex h-screen overflow-hidden">
      {/* Left Panel: Conversation List */}
      <div className="w-full md:w-[380px] border-r border-white/[0.06] flex flex-col">
        <div className="px-5 pt-5 pb-4 space-y-4">
          <h2 className="font-semibold text-xl tracking-tight">Conversations</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/[0.04] border-white/[0.08] focus-visible:border-white/20 h-9"
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
                    : "bg-white/[0.06] text-muted-foreground hover:bg-white/[0.1] hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <Separator className="bg-white/[0.06]" />

        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">
                {searchQuery || statusFilter !== "all"
                  ? "No conversations found"
                  : "No conversations yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
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
                      ? "bg-white/[0.06]"
                      : "hover:bg-white/[0.03]"
                  }`}
                >
                  {selectedConvo?.id === convo.id && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#ff7e67]" />
                  )}
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0 mt-0.5">
                      <AvatarFallback className="text-xs bg-white/[0.08] text-foreground/80">
                        {getInitials(convo.sender_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {convo.sender_name || "Unknown"}
                        </span>
                        <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap shrink-0">
                          {timeAgo(convo.updated_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={convo.status} />
                      </div>
                      <p className="text-xs text-muted-foreground/70 truncate mt-1.5 leading-relaxed">
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
      <div className={`flex-1 flex flex-col ${selectedConvo ? "" : "hidden md:flex"}`}>
        {selectedConvo ? (
          <>
            {/* Conversation Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setSelectedConvo(null)}
                >
                  &larr;
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-white/[0.08] text-foreground/80">
                    {getInitials(selectedConvo.sender_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-[15px]">
                    {selectedConvo.sender_name || "Unknown"}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Select
                      value={selectedConvo.status || "qualifying"}
                      onValueChange={handleStatusChange}
                    >
                      <SelectTrigger className="h-7 text-xs w-auto border-none p-0 focus:ring-0">
                        <StatusBadge status={selectedConvo.status} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qualifying">Qualifying</SelectItem>
                        <SelectItem value="interested">Interested</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="not_a_fit">Not a Fit</SelectItem>
                        <SelectItem value="manual">Human Takeover</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedConvo.ai_paused && (
                      <span className="text-xs text-amber-400/80 flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        AI paused
                      </span>
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
                    className="gap-1.5 border-white/[0.1] hover:bg-white/[0.06]"
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
                    className="gap-1.5 border-white/[0.1] hover:bg-white/[0.06]"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    Resume AI
                  </Button>
                )}
              </div>
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
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Messages will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isOutbound = msg.role === "assistant";
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${
                          isOutbound ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div className="max-w-[70%]">
                          <div
                            className={`rounded-2xl px-4 py-2.5 ${
                              isOutbound
                                ? "bg-[#ff7e67] text-white rounded-br-md"
                                : "bg-white/[0.06] rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                          <div
                            className={`flex items-center gap-1.5 mt-1 px-1 ${
                              isOutbound ? "justify-end" : "justify-start"
                            }`}
                          >
                            {isOutbound && (
                              <span className="text-[10px] font-medium text-muted-foreground/60 flex items-center gap-0.5">
                                <Bot className="h-2.5 w-2.5" />
                                AI
                              </span>
                            )}
                            {msg.role === "user" && (
                              <span className="text-[10px] font-medium text-muted-foreground/60 flex items-center gap-0.5">
                                <User className="h-2.5 w-2.5" />
                                Lead
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground/40">
                              {timeAgo(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t border-white/[0.06] p-4">
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2"
              >
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sending}
                  className="flex-1 bg-white/[0.04] border-white/[0.08] focus-visible:border-white/20"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newMessage.trim() || sending}
                  className="bg-[#ff7e67] hover:bg-[#ff6b52] text-white shrink-0"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-5">
              <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium mb-1.5 text-foreground/80">
              No conversation selected
            </h3>
            <p className="text-sm text-muted-foreground/60">
              Choose a conversation from the list to view messages
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
