"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  FlaskConical,
  Send,
  Loader2,
  RefreshCw,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Info,
  User,
  Bot,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "next/link";

const STARTER_PROMPTS = [
  "Hey, I saw your post and I'm interested",
  "How much does it cost?",
  "What exactly is included?",
  "I've tried coaching before and it didn't work",
  "I don't really have the time right now",
  "Can you tell me more about what you do?",
];

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-end gap-2 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-1 ${
          isUser
            ? "bg-stone-200"
            : "bg-[#ff7e67]/10 border border-[#ff7e67]/20"
        }`}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-stone-500" />
        ) : (
          <Zap className="h-3 w-3 text-[#ff7e67]" />
        )}
      </div>

      <div
        className={`max-w-[72%] space-y-1 ${
          isUser ? "items-end" : "items-start"
        } flex flex-col`}
      >
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-[#ff7e67] text-white rounded-br-sm"
              : "bg-white text-stone-800 border border-stone-200 rounded-bl-sm shadow-sm"
          }`}
        >
          {message.content}

          {message.hasBookingLink && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#ff7e67]">
              <Link2 className="h-3 w-3" />
              <span>Booking link included</span>
            </div>
          )}
        </div>

        <span className="text-[10px] text-stone-400 px-1">
          {isUser ? "You (test lead)" : "AI Agent"} &middot;{" "}
          {formatTime(new Date(message.timestamp))}
        </span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-[#ff7e67]/20 border border-[#ff7e67]/30 flex items-center justify-center shrink-0">
        <Zap className="h-3 w-3 text-[#ff7e67]" />
      </div>
      <div className="bg-white border border-stone-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  const router = useRouter();
  const supabase = createClient();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [scriptConfig, setScriptConfig] = useState(null);
  const [hasScript, setHasScript] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState(null);
  const [rateLimitMessage, setRateLimitMessage] = useState(null);

  const [sessionStats, setSessionStats] = useState({
    messageCount: 0,
    bookingLinkSent: false,
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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
        .select("script_config, calendly_url, ai_mode")
        .eq("id", authUser.id)
        .single();

      if (userProfile) {
        setProfile(userProfile);
        setScriptConfig(userProfile.script_config || null);
        const sc = userProfile.script_config || {};
        setHasScript(!!sc.greeting || !!sc.offer);
      }

      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The API route refetches script_config per request, so replies always use
  // the latest saved script — but the side panel and the hasScript gate were
  // frozen at mount. Refetch on tab focus so mid-session edits made in the
  // Script Builder show up without a full reload.
  const refreshProfile = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: userProfile } = await supabase
      .from("users")
      .select("script_config, calendly_url, ai_mode")
      .eq("id", authUser.id)
      .single();

    if (userProfile) {
      setProfile(userProfile);
      setScriptConfig(userProfile.script_config || null);
      const sc = userProfile.script_config || {};
      setHasScript(!!sc.greeting || !!sc.offer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === "visible") refreshProfile();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [refreshProfile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = (text || input).trim();
      if (!trimmed || isThinking) return;

      setInput("");
      setError(null);

      const userMessage = {
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsThinking(true);

      try {
        const payload = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/ai/playground", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payload }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.error === "no_script") {
            setError("no_script");
          } else if (data.error === "rate_limited") {
            setRateLimitMessage(
              data.message || "Hourly limit reached. Try again later."
            );
            setError("rate_limited");
          } else {
            setError("generation_failed");
          }
          setMessages(messages);
          // Restore the failed message so retry is one click, not a retype
          setInput(trimmed);
          return;
        }

        const aiMessage = {
          role: "assistant",
          content: data.reply,
          timestamp: Date.now(),
          hasBookingLink: data.hasBookingLink,
        };

        setMessages([...updatedMessages, aiMessage]);

        setSessionStats((prev) => ({
          messageCount: prev.messageCount + 1,
          bookingLinkSent: prev.bookingLinkSent || data.hasBookingLink,
        }));
      } catch (err) {
        console.error("Playground send error:", err);
        setError("generation_failed");
        setMessages(messages);
        // Restore the failed message so retry is one click, not a retype
        setInput(trimmed);
      } finally {
        setIsThinking(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [input, messages, isThinking]
  );

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const resetConversation = () => {
    setMessages([]);
    setError(null);
    setRateLimitMessage(null);
    setSessionStats({ messageCount: 0, bookingLinkSent: false });
    setConfirmResetOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleResetClick = () => {
    if (messages.length === 0 && !error) return;
    if (messages.length === 0) {
      resetConversation();
      return;
    }
    setConfirmResetOpen(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasScript) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            </div>
            <CardTitle>Set up your script first</CardTitle>
            <CardDescription>
              You need to create a sales script before you can test how your AI
              agent responds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/script-builder">
                Go to Script Builder
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-6 gap-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="h-5 w-5 text-[#ff7e67]" />
            <h1 className="text-xl font-bold">Agent Playground</h1>
            <Badge variant="secondary" className="text-xs">
              Test Mode
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Talk to your AI agent as if you were a potential lead. See exactly
            how it responds before going live.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {sessionStats.messageCount > 0 && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground border border-border rounded-lg px-3 py-2">
              <span>
                {sessionStats.messageCount} exchange
                {sessionStats.messageCount !== 1 ? "s" : ""}
              </span>
              {sessionStats.bookingLinkSent && (
                <>
                  <Separator orientation="vertical" className="h-3" />
                  <span className="flex items-center gap-1 text-green-500">
                    <CheckCircle2 className="h-3 w-3" />
                    Booking link sent
                  </span>
                </>
              )}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetClick}
            disabled={messages.length === 0 && !error}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-lg px-3.5 py-2.5 text-xs text-blue-700 shrink-0">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          This uses your exact saved script. Type messages as if you were a
          potential lead on Instagram.
          {!profile?.calendly_url && (
            <span className="text-yellow-600 ml-1">
              No booking link set &mdash; add one in{" "}
              <Link
                href="/script-builder"
                className="underline underline-offset-2"
              >
                Script Builder
              </Link>{" "}
              to test the full flow.
            </span>
          )}
        </span>
      </div>

      {/* Main chat area + script summary side by side on desktop */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Chat window */}
        <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
          {/* Messages area */}
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12 gap-6">
                <div className="w-14 h-14 bg-[#ff7e67]/10 rounded-full flex items-center justify-center">
                  <Zap className="h-6 w-6 text-[#ff7e67]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Start a test conversation
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Type a message below or pick a starter. The AI will respond
                    exactly like it would in a real Instagram DM.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-xs border border-stone-200 bg-white hover:bg-stone-100 rounded-full px-3 py-1.5 text-stone-600 hover:text-stone-900 transition-colors shadow-sm"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-2">
                {messages.map((msg, i) => (
                  <MessageBubble key={i} message={msg} />
                ))}
                {isThinking && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Error state */}
          {error && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-200">
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                {error === "no_script"
                  ? "No script found. Please save your script in Script Builder first."
                  : error === "rate_limited"
                    ? rateLimitMessage
                    : "Something went wrong generating a response. Try again."}
              </p>
            </div>
          )}

          {/* Input area */}
          <div className="p-3 border-t border-stone-200 bg-white">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message as a test lead..."
                  disabled={isThinking}
                  className="bg-stone-50 border-stone-200 focus-visible:border-[#ff7e67] pr-4 text-sm"
                  autoFocus
                />
              </div>
              <Button
                size="icon"
                onClick={() => sendMessage()}
                disabled={!input.trim() || isThinking}
                className="shrink-0 bg-[#ff7e67] hover:bg-[#ff6b52] text-white"
              >
                {isThinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
              Enter to send &middot; This is a simulation, no real DMs are sent
            </p>
          </div>
        </div>

        {/* Script summary panel — desktop only */}
        <div className="hidden lg:flex flex-col gap-3 w-64 shrink-0">
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Your Script</CardTitle>
              <CardDescription className="text-xs">
                What the AI is using
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {scriptConfig?.offer && (
                <div>
                  <p className="text-muted-foreground font-medium mb-1">
                    Offer
                  </p>
                  <p className="text-foreground leading-relaxed line-clamp-3">
                    {scriptConfig.offer}
                  </p>
                </div>
              )}

              {scriptConfig?.greeting && (
                <div>
                  <p className="text-muted-foreground font-medium mb-1">
                    Greeting
                  </p>
                  <p className="text-foreground leading-relaxed line-clamp-3 italic">
                    &quot;{scriptConfig.greeting}&quot;
                  </p>
                </div>
              )}

              {scriptConfig?.qualifying_questions && (
                <div>
                  <p className="text-muted-foreground font-medium mb-1">
                    Qualifying Questions
                  </p>
                  <p className="text-foreground leading-relaxed whitespace-pre-line line-clamp-4">
                    {scriptConfig.qualifying_questions}
                  </p>
                </div>
              )}

              {profile?.calendly_url ? (
                <div>
                  <p className="text-muted-foreground font-medium mb-1">
                    Booking Link
                  </p>
                  <p className="text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Set
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground font-medium mb-1">
                    Booking Link
                  </p>
                  <p className="text-yellow-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Not set
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#ff7e67]/5 border-[#ff7e67]/20">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">Happy with it?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {profile?.ai_mode === "active"
                    ? "Your AI is already live on Instagram."
                    : "Activate your AI to start qualifying real leads."}
                </p>
              </div>
              {profile?.ai_mode === "active" ? (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/dashboard">View Dashboard</Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="w-full bg-[#ff7e67] hover:bg-[#ff6b52] text-white"
                  asChild
                >
                  <Link href="/dashboard">
                    Activate AI
                    <Zap className="h-3.5 w-3.5 ml-1.5" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Reset conversation?"
        description="This will clear the current playground session."
        confirmText="Reset"
        variant="default"
        onConfirm={resetConversation}
      />
    </div>
  );
}
