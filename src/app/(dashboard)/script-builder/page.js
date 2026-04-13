"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import posthog from "posthog-js";
import {
  Loader2,
  Sparkles,
  Save,
  RefreshCw,
  MessageSquare,
  HelpCircle,
  ShieldCheck,
  Link2,
  Target,
  ShoppingBag,
  Bot,
  User,
  Mic,
  Send,
  Check,
  Trash2,
  ClipboardPaste,
  MessageCircle,
  Lock,
  Compass,
  Wand2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

function ChatBubble({ message, isAi }) {
  return (
    <div className={`flex ${isAi ? "justify-start" : "justify-end"} mb-3`}>
      <div
        className={`flex items-start gap-2 max-w-[80%] ${
          isAi ? "flex-row" : "flex-row-reverse"
        }`}
      >
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5 ${
            isAi
              ? "bg-primary/15 text-primary"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          {isAi ? (
            <Bot className="h-3.5 w-3.5" />
          ) : (
            <User className="h-3.5 w-3.5" />
          )}
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            isAi
              ? "bg-muted text-foreground rounded-tl-sm"
              : "bg-primary text-primary-foreground rounded-tr-sm"
          }`}
        >
          {message}
        </div>
      </div>
    </div>
  );
}

export default function ScriptBuilderPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regeneratingPreview, setRegeneratingPreview] = useState(false);
  const [user, setUser] = useState(null);

  // Core script config fields
  const [offer, setOffer] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [objections, setObjections] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");

  // Script mode
  const [scriptMode, setScriptMode] = useState("guided");

  // Generated script fields
  const [greeting, setGreeting] = useState("");
  const [qualifyingQuestions, setQualifyingQuestions] = useState("");
  const [interestResponse, setInterestResponse] = useState("");
  const [objectionHandlers, setObjectionHandlers] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [notAFitMessage, setNotAFitMessage] = useState("");

  // Voice profile
  const [voiceProfile, setVoiceProfile] = useState(null);
  const [voiceMode, setVoiceMode] = useState(null); // null | "paste" | "chat"
  const [sampleText, setSampleText] = useState("");
  const [analyzingVoice, setAnalyzingVoice] = useState(false);
  const [voiceChatMessages, setVoiceChatMessages] = useState([]);
  const [voiceChatInput, setVoiceChatInput] = useState("");
  const [voiceChatLoading, setVoiceChatLoading] = useState(false);
  const [finalizingVoice, setFinalizingVoice] = useState(false);

  // Preview conversation
  const [previewMessages, setPreviewMessages] = useState([]);

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

      const { data: profile } = await supabase
        .from("users")
        .select("script_config, calendly_url, voice_profile")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        if (profile.script_config) {
          const config = profile.script_config;
          setOffer(config.offer || "");
          setTargetCustomer(config.targetCustomer || "");
          if (config.script_mode) setScriptMode(config.script_mode);
          setObjections(config.objections || "");
          setGreeting(config.greeting || "");
          setQualifyingQuestions(
            Array.isArray(config.qualifying_questions)
              ? config.qualifying_questions.join("\n")
              : config.qualifying_questions || ""
          );
          setInterestResponse(config.interest_response || "");
          setObjectionHandlers(
            typeof config.objection_handlers === "object" &&
              !Array.isArray(config.objection_handlers)
              ? Object.entries(config.objection_handlers)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n")
              : config.objection_handlers || ""
          );
          setBookingMessage(config.booking_message || "");
          setNotAFitMessage(config.not_a_fit_message || "");
        }
        if (profile.calendly_url) {
          setCalendlyUrl(profile.calendly_url);
        }
        if (profile.voice_profile) {
          setVoiceProfile(profile.voice_profile);
        }
      }

      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnalyzeVoice = async () => {
    const messages = sampleText
      .split("\n")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    if (messages.length < 3) return;

    setAnalyzingVoice(true);
    try {
      const res = await fetch("/api/ai/analyze-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sample_messages: messages }),
      });

      const data = await res.json();
      if (data.voice_profile) {
        setVoiceProfile(data.voice_profile);
        setVoiceMode(null);
        setSampleText("");
        posthog.capture("voice_analyzed", { method: "paste" });
      }
    } catch (err) {
      console.error("Error analyzing voice:", err);
    } finally {
      setAnalyzingVoice(false);
    }
  };

  const handleStartVoiceChat = async () => {
    setVoiceMode("chat");
    setVoiceChatMessages([]);
    setVoiceChatLoading(true);

    try {
      const res = await fetch("/api/ai/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "Hey, I want to set up my voice profile. Ask me some questions so you can learn how I write.",
            },
          ],
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setVoiceChatMessages([{ role: "assistant", content: data.reply }]);
      }
    } catch (err) {
      console.error("Error starting voice chat:", err);
    } finally {
      setVoiceChatLoading(false);
    }
  };

  const handleSendVoiceChat = async () => {
    if (!voiceChatInput.trim() || voiceChatLoading) return;

    const newMessages = [
      ...voiceChatMessages,
      { role: "user", content: voiceChatInput.trim() },
    ];
    setVoiceChatMessages(newMessages);
    setVoiceChatInput("");
    setVoiceChatLoading(true);

    try {
      const res = await fetch("/api/ai/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "Hey, I want to set up my voice profile. Ask me some questions so you can learn how I write.",
            },
            ...newMessages,
          ],
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setVoiceChatMessages([
          ...newMessages,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch (err) {
      console.error("Error in voice chat:", err);
    } finally {
      setVoiceChatLoading(false);
    }
  };

  const handleFinalizeVoiceChat = async () => {
    setFinalizingVoice(true);
    try {
      const res = await fetch("/api/ai/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "Hey, I want to set up my voice profile. Ask me some questions so you can learn how I write.",
            },
            ...voiceChatMessages,
          ],
          finalize: true,
        }),
      });

      const data = await res.json();
      if (data.voice_profile) {
        setVoiceProfile(data.voice_profile);
        setVoiceMode(null);
        setVoiceChatMessages([]);
        posthog.capture("voice_analyzed", { method: "chat" });
      }
    } catch (err) {
      console.error("Error finalizing voice:", err);
    } finally {
      setFinalizingVoice(false);
    }
  };

  const handleRemoveVoice = async () => {
    try {
      await supabase
        .from("users")
        .update({ voice_profile: null })
        .eq("id", user.id);
      setVoiceProfile(null);
      posthog.capture("voice_removed");
    } catch (err) {
      console.error("Error removing voice:", err);
    }
  };

  const sampleMessageCount = sampleText
    .split("\n")
    .filter((m) => m.trim().length > 0).length;

  const buildPreviewConversation = () => {
    const messages = [];
    const questions = qualifyingQuestions
      .split("\n")
      .filter((q) => q.trim());

    // Lead initiates
    messages.push({
      text: "Hey! I saw your post about your program. Can you tell me more?",
      isAi: false,
    });

    // AI greeting
    if (greeting) {
      messages.push({ text: greeting, isAi: true });
    }

    // Qualifying flow
    if (questions.length > 0) {
      messages.push({ text: questions[0], isAi: true });
      messages.push({
        text: "I'm currently running a marketing agency doing about $20k/month.",
        isAi: false,
      });
    }

    if (questions.length > 1) {
      messages.push({ text: questions[1], isAi: true });
      messages.push({
        text: "My biggest challenge is finding time to focus on growth while handling all the client work.",
        isAi: false,
      });
    }

    // Interest response
    if (interestResponse) {
      messages.push({ text: interestResponse, isAi: true });
      messages.push({
        text: "That sounds really helpful! But I'm not sure I can afford it right now.",
        isAi: false,
      });
    }

    // Objection handling
    if (objectionHandlers) {
      const firstHandler = objectionHandlers
        .split("\n")
        .filter((h) => h.trim())[0];
      if (firstHandler) {
        messages.push({ text: firstHandler, isAi: true });
      }
    }

    messages.push({
      text: "Actually, that makes sense. I'd love to learn more. What's the next step?",
      isAi: false,
    });

    // Booking message
    if (bookingMessage) {
      messages.push({ text: bookingMessage, isAi: true });
    }

    messages.push({
      text: "Just booked a slot! Looking forward to the call.",
      isAi: false,
    });

    return messages;
  };

  const handleGenerateScript = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer, targetCustomer, objections }),
      });

      const data = await res.json();

      if (data.script) {
        const script = data.script;
        setGreeting(script.greeting || "");
        setQualifyingQuestions(
          Array.isArray(script.qualifying_questions)
            ? script.qualifying_questions.join("\n")
            : script.qualifying_questions || ""
        );
        setInterestResponse(script.interest_response || "");
        setObjectionHandlers(
          typeof script.objection_handlers === "object" &&
            !Array.isArray(script.objection_handlers)
            ? Object.entries(script.objection_handlers)
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")
            : script.objection_handlers || ""
        );
        setBookingMessage(script.booking_message || "");
        setNotAFitMessage(script.not_a_fit_message || "");
        posthog.capture("script_generated");
      }
    } catch (err) {
      console.error("Error generating script:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const scriptConfig = {
        offer,
        targetCustomer,
        objections,
        greeting,
        qualifying_questions: qualifyingQuestions,
        interest_response: interestResponse,
        objection_handlers: objectionHandlers,
        booking_message: bookingMessage,
        not_a_fit_message: notAFitMessage,
        script_mode: scriptMode,
      };

      await supabase
        .from("users")
        .update({
          script_config: scriptConfig,
          calendly_url: calendlyUrl,
        })
        .eq("id", user.id);

      posthog.capture("script_saved");
    } catch (err) {
      console.error("Error saving script:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRegeneratePreview = () => {
    setRegeneratingPreview(true);
    const messages = buildPreviewConversation();
    setTimeout(() => {
      setPreviewMessages(messages);
      setRegeneratingPreview(false);
    }, 500);
  };

  const handleTabChange = (value) => {
    if (value === "preview" && previewMessages.length === 0 && greeting) {
      const messages = buildPreviewConversation();
      setPreviewMessages(messages);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Sales Script</h1>
        <p className="text-muted-foreground mt-1">
          Create and customize the AI conversation script for your DMs.
        </p>
      </div>

      <Tabs defaultValue="edit" onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="edit">Edit Script</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* Edit Tab */}
        <TabsContent value="edit">
          <div className="space-y-6 mt-4">
            {/* Your Voice Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Mic className="h-5 w-5" />
                      Your Voice
                    </CardTitle>
                    <CardDescription>
                      {voiceProfile?.status === "ready"
                        ? "Your voice profile is active. AI responses will match your writing style."
                        : "Teach the AI to write exactly like you so DM replies sound authentic."}
                    </CardDescription>
                  </div>
                  {voiceProfile?.status === "ready" && (
                    <Badge variant="success">Active</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {voiceProfile?.status === "ready" && !voiceMode ? (
                  // Configured state — show voice summary
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                      <p className="text-sm italic">
                        &ldquo;{voiceProfile.voice_summary}&rdquo;
                      </p>
                      <Separator />
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {voiceProfile.voice_traits?.tone && (
                          <div>
                            <span className="font-medium">Tone:</span>{" "}
                            {voiceProfile.voice_traits.tone}
                          </div>
                        )}
                        {voiceProfile.voice_traits?.formality && (
                          <div>
                            <span className="font-medium">Formality:</span>{" "}
                            {voiceProfile.voice_traits.formality}
                          </div>
                        )}
                        {voiceProfile.voice_traits?.emoji_usage && (
                          <div>
                            <span className="font-medium">Emoji:</span>{" "}
                            {voiceProfile.voice_traits.emoji_usage}
                          </div>
                        )}
                        {voiceProfile.voice_traits?.personality && (
                          <div>
                            <span className="font-medium">Personality:</span>{" "}
                            {voiceProfile.voice_traits.personality}
                          </div>
                        )}
                      </div>
                      {voiceProfile.voice_traits?.catchphrases?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {voiceProfile.voice_traits.catchphrases.map(
                            (phrase, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {phrase}
                              </Badge>
                            )
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVoiceMode("paste")}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Re-analyze
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setVoiceMode("chat");
                          handleStartVoiceChat();
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Refine with Chat
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveVoice}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : voiceMode === "paste" ? (
                  // Paste flow
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <ClipboardPaste className="h-3.5 w-3.5" />
                        Paste your messages
                      </Label>
                      <Textarea
                        value={sampleText}
                        onChange={(e) => setSampleText(e.target.value)}
                        rows={8}
                        placeholder={`Paste real messages you've sent — DMs, texts, or social posts. One message per line.\n\nExample:\nhey! saw your post, that's fire. what made you start your agency?\nhonestly that's impressive for 6 months in. what's your biggest bottleneck rn?\nyeah I totally get that. we actually help with exactly that kind of thing\nfor sure, let me send you the link to book a quick call`}
                      />
                      <p className="text-xs text-muted-foreground">
                        {sampleMessageCount} message{sampleMessageCount !== 1 ? "s" : ""} detected
                        {sampleMessageCount < 3
                          ? " (minimum 3 needed)"
                          : sampleMessageCount < 5
                          ? " (5+ recommended for best results)"
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleAnalyzeVoice}
                        disabled={analyzingVoice || sampleMessageCount < 3}
                      >
                        {analyzingVoice ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {analyzingVoice ? "Analyzing..." : "Analyze My Voice"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setVoiceMode(null);
                          setSampleText("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : voiceMode === "chat" ? (
                  // Chat flow
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-background p-4 max-h-80 overflow-y-auto space-y-3">
                      {voiceChatMessages.map((msg, i) => (
                        <ChatBubble
                          key={i}
                          message={msg.content}
                          isAi={msg.role === "assistant"}
                        />
                      ))}
                      {voiceChatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-2xl px-4 py-2.5 rounded-tl-sm">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={voiceChatInput}
                        onChange={(e) => setVoiceChatInput(e.target.value)}
                        placeholder="Type naturally, like you'd message a client..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendVoiceChat();
                          }
                        }}
                        disabled={voiceChatLoading}
                      />
                      <Button
                        size="icon"
                        onClick={handleSendVoiceChat}
                        disabled={voiceChatLoading || !voiceChatInput.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      {voiceChatMessages.filter((m) => m.role === "user")
                        .length >= 3 && (
                        <Button
                          onClick={handleFinalizeVoiceChat}
                          disabled={finalizingVoice}
                        >
                          {finalizingVoice ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          {finalizingVoice ? "Saving..." : "Finish & Save"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setVoiceMode(null);
                          setVoiceChatMessages([]);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Empty state — choose method
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setVoiceMode("paste")}
                      className="flex-1 rounded-lg border-2 border-dashed p-6 text-center hover:border-primary/50 hover:bg-muted/50 transition-colors"
                    >
                      <ClipboardPaste className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Paste Sample Messages</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Paste 5+ real DMs, texts, or posts you&apos;ve written
                      </p>
                    </button>
                    <button
                      onClick={() => {
                        setVoiceMode("chat");
                        handleStartVoiceChat();
                      }}
                      className="flex-1 rounded-lg border-2 border-dashed p-6 text-center hover:border-primary/50 hover:bg-muted/50 transition-colors"
                    >
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Chat with AI</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Have a quick conversation so the AI can learn your style
                      </p>
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Business Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Business Information</CardTitle>
                <CardDescription>
                  This information is used to generate and refine your AI script.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="offer" className="flex items-center gap-2">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    What do you sell?
                  </Label>
                  <Textarea
                    id="offer"
                    placeholder="Describe your offer or service..."
                    value={offer}
                    onChange={(e) => setOffer(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="targetCustomer"
                    className="flex items-center gap-2"
                  >
                    <Target className="h-3.5 w-3.5" />
                    Who is your ideal customer?
                  </Label>
                  <Textarea
                    id="targetCustomer"
                    placeholder="Describe your target customer..."
                    value={targetCustomer}
                    onChange={(e) => setTargetCustomer(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="objections"
                    className="flex items-center gap-2"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Common objections and how to handle them
                  </Label>
                  <Textarea
                    id="objections"
                    placeholder="List common objections and responses..."
                    value={objections}
                    onChange={(e) => setObjections(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="calendlyUrl"
                    className="flex items-center gap-2"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Booking link (Calendly / Cal.com)
                  </Label>
                  <Input
                    id="calendlyUrl"
                    type="url"
                    placeholder="https://calendly.com/yourname/30min"
                    value={calendlyUrl}
                    onChange={(e) => setCalendlyUrl(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleGenerateScript}
                  disabled={generating || !offer || !targetCustomer}
                  variant="outline"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generating ? "Generating..." : "Generate with AI"}
                </Button>
              </CardFooter>
            </Card>

            {/* Conversation Script Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Conversation Script</CardTitle>
                <CardDescription>
                  {scriptMode === "strict"
                    ? "The AI will use these exact messages word-for-word in DMs."
                    : scriptMode === "guided"
                    ? "The AI follows this structure but phrases everything naturally in your voice."
                    : "The AI handles the entire conversation freely using your voice and business details."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Script Mode Toggle */}
                <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Script Mode
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: "strict",
                        label: "Strict",
                        icon: Lock,
                        desc: "AI reads your exact script",
                      },
                      {
                        id: "guided",
                        label: "Guided",
                        icon: Compass,
                        desc: "AI follows your structure, uses own words",
                      },
                      {
                        id: "freestyle",
                        label: "Freestyle",
                        icon: Wand2,
                        desc: "AI handles the full conversation",
                      },
                    ].map(({ id, label, icon: Icon, desc }) => (
                      <button
                        key={id}
                        onClick={() => setScriptMode(id)}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center transition-all ${
                          scriptMode === id
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:border-border"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${scriptMode === id ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-semibold ${scriptMode === id ? "text-primary" : ""}`}>
                          {label}
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {desc}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Explainer for each mode */}
                  <div className="flex items-start gap-2 rounded-lg bg-background border p-3">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {scriptMode === "strict" && (
                        <>
                          <span className="font-semibold text-foreground">Strict mode:</span>{" "}
                          The AI uses your script fields exactly as written. Every greeting, question,
                          and objection handler is delivered word-for-word. Best when you need full
                          control over messaging or have compliance requirements.
                        </>
                      )}
                      {scriptMode === "guided" && (
                        <>
                          <span className="font-semibold text-foreground">Guided mode:</span>{" "}
                          The AI follows your conversation structure (qualify → handle objections → book)
                          but rephrases everything naturally in your voice. Your script fields become
                          guidelines, not verbatim lines. This produces the most natural-sounding conversations
                          while keeping your sales flow intact.
                        </>
                      )}
                      {scriptMode === "freestyle" && (
                        <>
                          <span className="font-semibold text-foreground">Freestyle mode:</span>{" "}
                          The AI has full creative freedom. It only uses your offer, target customer,
                          and booking link to guide the conversation. Script fields below are ignored.
                          Best for users with a strong voice profile who trust the AI to sell naturally.
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {scriptMode === "freestyle" && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Wand2 className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm font-medium">
                      Script fields are disabled in Freestyle mode
                    </p>
                    <p className="text-xs mt-1">
                      The AI uses your business info and voice profile to handle conversations naturally.
                    </p>
                  </div>
                )}

                {scriptMode !== "freestyle" && (
                <>
                <div className="space-y-2">
                  <Label htmlFor="greeting" className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {scriptMode === "strict" ? "Greeting Message" : "Greeting Approach"}
                  </Label>
                  <Textarea
                    id="greeting"
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    rows={2}
                    placeholder="The opening message sent to new DMs..."
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="qualifyingQuestions"
                    className="flex items-center gap-2"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    {scriptMode === "strict" ? "Qualifying Questions" : "Qualifying Goals"}
                  </Label>
                  <Textarea
                    id="qualifyingQuestions"
                    value={qualifyingQuestions}
                    onChange={(e) => setQualifyingQuestions(e.target.value)}
                    rows={4}
                    placeholder="One question per line..."
                  />
                  <p className="text-xs text-muted-foreground">
                    {scriptMode === "strict"
                      ? "One question per line. These are asked sequentially to qualify leads."
                      : "One topic per line. The AI will ask about these naturally in its own words."}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="interestResponse"
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Interest Response
                  </Label>
                  <Textarea
                    id="interestResponse"
                    value={interestResponse}
                    onChange={(e) => setInterestResponse(e.target.value)}
                    rows={2}
                    placeholder="Response when a lead shows interest..."
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="objectionHandlers"
                    className="flex items-center gap-2"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Objection Handlers
                  </Label>
                  <Textarea
                    id="objectionHandlers"
                    value={objectionHandlers}
                    onChange={(e) => setObjectionHandlers(e.target.value)}
                    rows={4}
                    placeholder="How to handle common objections..."
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="bookingMessage"
                    className="flex items-center gap-2"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Booking Message
                  </Label>
                  <Textarea
                    id="bookingMessage"
                    value={bookingMessage}
                    onChange={(e) => setBookingMessage(e.target.value)}
                    rows={2}
                    placeholder="Message sent when sharing the booking link..."
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="notAFitMessage"
                    className="flex items-center gap-2"
                  >
                    <Target className="h-3.5 w-3.5" />
                    Not a Fit Message
                  </Label>
                  <Textarea
                    id="notAFitMessage"
                    value={notAFitMessage}
                    onChange={(e) => setNotAFitMessage(e.target.value)}
                    rows={2}
                    placeholder="Polite message when the lead isn't a good fit..."
                  />
                </div>
                </>
                )}
              </CardContent>
              <CardFooter>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <Card className="mt-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Conversation Preview
                  </CardTitle>
                  <CardDescription>
                    A simulated DM conversation showing how your AI will interact
                    with leads.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegeneratePreview}
                  disabled={regeneratingPreview}
                >
                  {regeneratingPreview ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Regenerate Preview
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {previewMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mb-3" />
                  <p className="text-sm">No preview generated yet</p>
                  <p className="text-xs mt-1">
                    {greeting
                      ? "Click \"Regenerate Preview\" to see a sample conversation."
                      : "Configure your script in the Edit tab first, then come back to preview."}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border bg-background p-4">
                  {/* Chat Header */}
                  <div className="flex items-center gap-2 pb-3 mb-3 border-b">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff7e67]">
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Instagram DMs</p>
                      <p className="text-xs text-muted-foreground">
                        Simulated conversation preview
                      </p>
                    </div>
                    <Badge variant="secondary" className="ml-auto">
                      Preview
                    </Badge>
                  </div>

                  {/* Messages */}
                  <div className="space-y-1 py-2">
                    {previewMessages.map((msg, i) => (
                      <ChatBubble
                        key={i}
                        message={msg.text}
                        isAi={msg.isAi}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
