"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Zap,
  Instagram,
  FileText,
  Eye,
  Rocket,
  Loader2,
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Link2,
  MessageSquare,
  HelpCircle,
  Target,
  ShoppingBag,
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
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const STEPS = [
  { number: 1, title: "Connect Instagram", icon: Instagram },
  { number: 2, title: "Sales Script", icon: FileText },
  { number: 3, title: "Preview Script", icon: Eye },
  { number: 4, title: "Go Live", icon: Rocket },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // Step 2 form fields
  const [offer, setOffer] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [objections, setObjections] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");

  // Step 3 generated script fields
  const [greeting, setGreeting] = useState("");
  const [qualifyingQuestions, setQualifyingQuestions] = useState("");
  const [interestResponse, setInterestResponse] = useState("");
  const [objectionHandlers, setObjectionHandlers] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [notAFitMessage, setNotAFitMessage] = useState("");

  // Step 4
  const [aiActive, setAiActive] = useState(false);
  const [activating, setActivating] = useState(false);

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

        // Pre-populate form fields from existing config
        if (userProfile.script_config) {
          const config = userProfile.script_config;
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
        if (userProfile.calendly_url) {
          setCalendlyUrl(userProfile.calendly_url);
        }
      }

      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progressValue = (step / STEPS.length) * 100;

  const handleSaveScriptConfig = async () => {
    setSaving(true);
    try {
      const scriptConfig = {
        offer,
        targetCustomer,
        objections,
        ...(profile?.script_config || {}),
        // Preserve generated fields if they exist
        ...(greeting && { greeting }),
        ...(qualifyingQuestions && {
          qualifying_questions: qualifyingQuestions,
        }),
        ...(interestResponse && { interest_response: interestResponse }),
        ...(objectionHandlers && { objection_handlers: objectionHandlers }),
        ...(bookingMessage && { booking_message: bookingMessage }),
        ...(notAFitMessage && { not_a_fit_message: notAFitMessage }),
      };

      // Always overwrite core fields
      scriptConfig.offer = offer;
      scriptConfig.targetCustomer = targetCustomer;
      scriptConfig.objections = objections;

      await supabase
        .from("users")
        .update({
          script_config: scriptConfig,
          calendly_url: calendlyUrl,
        })
        .eq("id", user.id);

      setProfile((prev) => ({
        ...prev,
        script_config: scriptConfig,
        calendly_url: calendlyUrl,
      }));

      setStep(3);
    } catch (err) {
      console.error("Error saving script config:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateScript = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer,
          targetCustomer,
          objections,
        }),
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

  const handleSaveGeneratedScript = async () => {
    setSaving(true);
    try {
      const scriptConfig = {
        ...(profile?.script_config || {}),
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
        .update({ script_config: scriptConfig })
        .eq("id", user.id);

      setProfile((prev) => ({ ...prev, script_config: scriptConfig }));
      setStep(4);
    } catch (err) {
      console.error("Error saving generated script:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleGoLive = async (checked) => {
    setActivating(true);
    setAiActive(checked);

    try {
      await supabase
        .from("users")
        .update({
          ai_active: checked,
          onboarding_completed: true,
        })
        .eq("id", user.id);
    } catch (err) {
      console.error("Error going live:", err);
      setAiActive(!checked);
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-[#ff7e67] rounded-xl flex items-center justify-center shadow-lg shadow-[#ff7e67]/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">Clinchd</span>
        </div>

        {/* Step indicators */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.number;
              const isComplete = step > s.number;
              return (
                <div key={s.number} className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      isComplete
                        ? "bg-primary text-primary-foreground"
                        : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isActive || isComplete
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>
          <Progress value={progressValue} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Step {step} of {STEPS.length}
          </p>
        </div>

        {/* Step 1: Connect Instagram */}
        {step === 1 && (
          <Card className="mt-6">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ff7e67] mb-3">
                <Instagram className="h-7 w-7 text-white" />
              </div>
              <CardTitle className="text-xl">Connect Your Instagram</CardTitle>
              <CardDescription>
                Link your Instagram Business or Creator account so Clinchd can
                respond to DMs on your behalf.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  How it works
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2 ml-6 list-disc">
                  <li>
                    Click the button below to securely connect your Instagram
                    account through our authentication partner.
                  </li>
                  <li>
                    Clinchd reads new DMs and sends replies as your account to
                    qualify leads automatically.
                  </li>
                  <li>
                    You can disconnect at any time from Settings.
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Your Instagram credentials are handled securely by our
                    authentication partner and never touch our servers. We only
                    respond to messages initiated by users and never send
                    unsolicited outreach.
                  </span>
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button asChild className="w-full" size="lg">
                <a href="/api/auth/instagram">
                  <Instagram className="h-4 w-4" />
                  Connect Instagram Account
                </a>
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep(2)}
              >
                Skip for now
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 2: Set Up Sales Script */}
        {step === 2 && (
          <Card className="mt-6">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Set Up Your Sales Script</CardTitle>
              <CardDescription>
                Tell us about your business so we can create a personalized AI
                script that qualifies leads and books calls.
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
                  placeholder="e.g., I sell a 12-week coaching program that helps agency owners scale to $50k/month..."
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
                  placeholder="e.g., Agency owners doing $10-30k/month who want to scale but are stuck doing all the fulfillment..."
                  value={targetCustomer}
                  onChange={(e) => setTargetCustomer(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="objections" className="flex items-center gap-2">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Common objections and how to handle them
                </Label>
                <Textarea
                  id="objections"
                  placeholder={`e.g., "I don't have time" — We actually help you free up time by systematizing your operations...\n"It's too expensive" — The ROI typically covers the investment within the first month...`}
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
                  Your booking link (Calendly / Cal.com)
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
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleSaveScriptConfig}
                disabled={saving || !offer || !targetCustomer}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save &amp; Continue
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 3: Preview AI Script */}
        {step === 3 && (
          <Card className="mt-6">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
                <Eye className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Preview Your AI Script</CardTitle>
              <CardDescription>
                Generate and customize the AI conversation script. You can tweak
                each part before going live.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Button
                onClick={handleGenerateScript}
                disabled={generating}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating ? "Generating..." : "Generate AI Script"}
              </Button>

              {(greeting || qualifyingQuestions || bookingMessage) && (
                <div className="space-y-4 pt-2">
                  <Separator />

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
                      placeholder="Questions asked to qualify leads (one per line)..."
                    />
                    <p className="text-xs text-muted-foreground">
                      One question per line. These are asked sequentially.
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
                      placeholder="Message sent when sending the booking link..."
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
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleSaveGeneratedScript}
                disabled={saving || !greeting}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save &amp; Continue
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 4: Go Live */}
        {step === 4 && (
          <Card className="mt-6">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
                <Rocket className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Go Live</CardTitle>
              <CardDescription>
                Everything is set up. Review your configuration and activate your
                AI sales agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Setup Summary */}
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <h4 className="text-sm font-semibold">Setup Summary</h4>

                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Instagram className="h-4 w-4" />
                    Instagram Connected
                  </span>
                  {profile?.unipile_account_id ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Badge variant="warning">Not Connected</Badge>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Script Configured
                  </span>
                  {profile?.script_config?.greeting ? (
                    <Badge variant="success">Configured</Badge>
                  ) : (
                    <Badge variant="warning">Not Configured</Badge>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Booking Link Set
                  </span>
                  {profile?.calendly_url ? (
                    <Badge variant="success">Set</Badge>
                  ) : (
                    <Badge variant="warning">Not Set</Badge>
                  )}
                </div>
              </div>

              {/* Activate Toggle */}
              <div className="rounded-lg border p-6 text-center space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors ${
                      aiActive
                        ? "bg-green-500/15 text-green-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Zap className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {aiActive ? "AI Agent is Active" : "Activate AI Agent"}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {aiActive
                      ? "Your AI agent is now live and will handle incoming DMs automatically."
                      : "Toggle the switch to activate your AI sales agent. It will start responding to new DMs immediately."}
                  </p>
                  <Switch
                    checked={aiActive}
                    onCheckedChange={handleGoLive}
                    disabled={activating}
                  />
                  <span
                    className={`text-sm font-medium ${
                      aiActive ? "text-green-600" : "text-muted-foreground"
                    }`}
                  >
                    {aiActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                className="w-full"
                size="lg"
                onClick={() => router.push("/dashboard")}
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Script
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
