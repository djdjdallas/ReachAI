"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

  // Generated script fields
  const [greeting, setGreeting] = useState("");
  const [qualifyingQuestions, setQualifyingQuestions] = useState("");
  const [interestResponse, setInterestResponse] = useState("");
  const [objectionHandlers, setObjectionHandlers] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [notAFitMessage, setNotAFitMessage] = useState("");

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
        .select("script_config, calendly_url")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        if (profile.script_config) {
          const config = profile.script_config;
          setOffer(config.offer || "");
          setTargetCustomer(config.targetCustomer || "");
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
      }

      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      };

      await supabase
        .from("users")
        .update({
          script_config: scriptConfig,
          calendly_url: calendlyUrl,
        })
        .eq("id", user.id);
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
                  Fine-tune each part of the AI conversation flow. These fields
                  control exactly how the AI responds in DMs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="greeting" className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Greeting Message
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
                    Qualifying Questions
                  </Label>
                  <Textarea
                    id="qualifyingQuestions"
                    value={qualifyingQuestions}
                    onChange={(e) => setQualifyingQuestions(e.target.value)}
                    rows={4}
                    placeholder="One question per line..."
                  />
                  <p className="text-xs text-muted-foreground">
                    One question per line. These are asked sequentially to
                    qualify leads.
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
