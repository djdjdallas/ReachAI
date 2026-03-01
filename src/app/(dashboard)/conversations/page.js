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
import { Input } from "@/components/ui/input";

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
    case "manual":
      return "Manual";
    default:
      return status || "New";
  }
}

export default function ConversationsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch conversations list
  const fetchConversations = useCallback(
    async (userId) => {
      const uid = userId || user?.id;
      if (!uid) return;

      // Fix 8: Join messages to derive last_message since the column doesn't exist
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

  // Fetch messages for a conversation
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

  // Initialize: auth check, fetch conversations, auto-select from query param
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

      // Fix 8: Join messages to derive last_message since the column doesn't exist
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

      // Auto-select conversation from query param
      const threadId = searchParams.get("thread");
      if (threadId) {
        const match = convoList.find((c) => c.id === threadId);
        if (match) {
          setSelectedConvo(match);
        }
      }

      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch messages when selected conversation changes
  useEffect(() => {
    if (selectedConvo?.id) {
      fetchMessages(selectedConvo.id);
    } else {
      setMessages([]);
    }
  }, [selectedConvo?.id, fetchMessages]);

  // Realtime subscription on conversations table
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
          // If the updated conversation is the selected one, refresh its data
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase, fetchConversations, selectedConvo]);

  // Realtime subscription on messages table for the selected conversation
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
        () => {
          fetchMessages(selectedConvo.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConvo?.id, supabase, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSelectConversation = (convo) => {
    setSelectedConvo(convo);
    setNewMessage("");
    // Update URL without full navigation
    router.replace(`/conversations?thread=${convo.id}`, { scroll: false });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvo || sending) return;

    const messageText = newMessage.trim();
    setSending(true);
    setNewMessage("");

    // Optimistically add the message
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
      // Insert message into messages table
      await supabase.from("messages").insert({
        conversation_id: selectedConvo.id,
        role: "assistant",
        content: messageText,
      });

      // Send via API route
      await fetch("/api/ai/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConvo.id,
          message: messageText,
          manual: true,
        }),
      });

      // Refresh messages from server to get canonical data
      await fetchMessages(selectedConvo.id);
    } catch (error) {
      console.error("Failed to send message:", error);
      // Remove optimistic message on error
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

  // Filter conversations by search query
  const filteredConversations = conversations.filter((convo) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      convo.sender_name?.toLowerCase().includes(query) ||
      convo.last_message?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -m-8">
      {/* Left Panel: Conversation List */}
      <div className="w-96 border-r flex flex-col bg-background">
        {/* Search Header */}
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg mb-3">Conversations</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2" />
              <p className="text-sm">
                {searchQuery ? "No conversations found" : "No conversations yet"}
              </p>
            </div>
          ) : (
            filteredConversations.map((convo, index) => (
              <div key={convo.id}>
                {index > 0 && <Separator />}
                <button
                  onClick={() => handleSelectConversation(convo)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                    selectedConvo?.id === convo.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs">
                        {getInitials(convo.sender_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {convo.sender_name || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {timeAgo(convo.updated_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={statusVariant(convo.status)} className="shrink-0">
                          {statusLabel(convo.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {convo.last_message
                          ? convo.last_message.length > 50
                            ? convo.last_message.slice(0, 50) + "..."
                            : convo.last_message
                          : "No messages yet"}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Right Panel: Message Thread */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedConvo ? (
          <>
            {/* Conversation Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {getInitials(selectedConvo.sender_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">
                    {selectedConvo.sender_name || "Unknown"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(selectedConvo.status)}>
                      {statusLabel(selectedConvo.status)}
                    </Badge>
                    {selectedConvo.ai_paused && (
                      <span className="text-xs text-muted-foreground">
                        AI paused
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {selectedConvo.ai_paused && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResumeAi}
                  className="gap-2"
                >
                  <Bot className="h-4 w-4" />
                  Resume AI
                </Button>
              )}
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-6">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2" />
                  <p className="text-sm">No messages in this conversation</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === "assistant" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                          msg.role === "assistant"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.role === "assistant"
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          {timeAgo(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t p-4">
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2"
              >
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sending}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newMessage.trim() || sending}
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
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4" />
            <h3 className="text-lg font-medium mb-1">No conversation selected</h3>
            <p className="text-sm">
              Choose a conversation from the list to view messages
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
