"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import posthog from "posthog-js";
import {
  Loader2,
  Save,
  Check,
  User,
  Instagram,
  Bot,
  AlertTriangle,
  Clock,
  Calendar,
  CalendarClock,
  ExternalLink,
  DollarSign,
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // Profile
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // AI Settings
  const [aiActive, setAiActive] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [responseDelay, setResponseDelay] = useState(2);
  const [savingAi, setSavingAi] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);

  // Instagram
  const [disconnecting, setDisconnecting] = useState(false);

  // Calendar integrations
  const [gcalConnected, setGcalConnected] = useState(false);
  const [disconnectingGcal, setDisconnectingGcal] = useState(false);

  // Calendly
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [savingCalendly, setSavingCalendly] = useState(false);
  const [calendlySaved, setCalendlySaved] = useState(false);
  const [calendlyError, setCalendlyError] = useState(null);

  // Revenue / deal value
  const [avgDealValue, setAvgDealValue] = useState("");
  const [savingDealValue, setSavingDealValue] = useState(false);
  const [dealValueSaved, setDealValueSaved] = useState(false);
  const [dealValueError, setDealValueError] = useState(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data?.error || "Failed to delete account");
        setDeleting(false);
        return;
      }
      posthog.capture("account_deleted");
      posthog.reset();
      await supabase.auth.signOut();
      window.location.href = "/login?deleted=true";
    } catch (err) {
      setDeleteError("An unexpected error occurred. Please try again.");
      setDeleting(false);
    }
  };

  useEffect(() => {
    async function init() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        router.push("/login");
        return;
      }

      setAuthUser(currentUser);

      const { data: userProfile } = await supabase
        .from("users")
        .select("*")
        .eq("id", currentUser.id)
        .single();

      if (userProfile) {
        setProfile(userProfile);
        setFullName(userProfile.full_name || "");
        setAiActive(userProfile.ai_active || false);
        setResponseDelay(userProfile.response_delay || 2);
        setGcalConnected(!!userProfile.google_calendar_refresh_token);
        setCalendlyUrl(userProfile.calendly_url || "");
        setAvgDealValue(
          userProfile.avg_deal_value != null
            ? String(userProfile.avg_deal_value)
            : ""
        );
      }

      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await supabase
        .from("users")
        .update({ full_name: fullName })
        .eq("id", authUser.id);

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleAi = async (checked) => {
    setTogglingAi(true);
    setAiActive(checked);

    try {
      await supabase
        .from("users")
        .update({ ai_active: checked })
        .eq("id", authUser.id);

      posthog.capture("ai_agent_toggled", { active: checked });
    } catch (err) {
      console.error("Error toggling AI:", err);
      setAiActive(!checked);
    } finally {
      setTogglingAi(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setSavingAi(true);
    try {
      const clampedDelay = Math.min(Math.max(Number(responseDelay) || 1, 1), 120);
      setResponseDelay(clampedDelay);

      await supabase
        .from("users")
        .update({ response_delay: clampedDelay })
        .eq("id", authUser.id);

      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2000);
    } catch (err) {
      console.error("Error saving AI settings:", err);
    } finally {
      setSavingAi(false);
    }
  };

  const handleSaveDealValue = async () => {
    setDealValueError(null);
    const trimmed = avgDealValue.trim();
    let parsedValue = null;

    if (trimmed) {
      const num = Number(trimmed);
      if (Number.isNaN(num) || num < 0) {
        setDealValueError("Please enter a valid non-negative number.");
        return;
      }
      if (num > 10_000_000) {
        setDealValueError("Value is too large.");
        return;
      }
      parsedValue = num;
    }

    setSavingDealValue(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ avg_deal_value: parsedValue })
        .eq("id", authUser.id);

      if (error) throw error;

      setProfile((prev) => ({ ...prev, avg_deal_value: parsedValue }));
      setDealValueSaved(true);
      setTimeout(() => setDealValueSaved(false), 2000);
    } catch (err) {
      console.error("Error saving deal value:", err);
      setDealValueError("Failed to save. Please try again.");
    } finally {
      setSavingDealValue(false);
    }
  };

  const handleSaveCalendly = async () => {
    setCalendlyError(null);
    const trimmed = calendlyUrl.trim();

    if (trimmed) {
      try {
        const parsed = new URL(trimmed);
        if (!parsed.hostname.endsWith("calendly.com")) {
          setCalendlyError("URL must be a calendly.com link.");
          return;
        }
      } catch {
        setCalendlyError("Please enter a valid URL.");
        return;
      }
    }

    setSavingCalendly(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ calendly_url: trimmed || null })
        .eq("id", authUser.id);

      if (error) throw error;

      setCalendlyUrl(trimmed);
      setProfile((prev) => ({ ...prev, calendly_url: trimmed || null }));
      setCalendlySaved(true);
      setTimeout(() => setCalendlySaved(false), 2000);
    } catch (err) {
      console.error("Error saving Calendly URL:", err);
      setCalendlyError("Failed to save. Please try again.");
    } finally {
      setSavingCalendly(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    setDisconnecting(true);
    try {
      // Call backend to disconnect from Unipile + clear DB
      await fetch("/api/auth/instagram/disconnect", { method: "POST" });

      posthog.capture("instagram_disconnected");
      setProfile((prev) => ({
        ...prev,
        unipile_account_id: null,
        instagram_business_account_id: null,
      }));
    } catch (err) {
      console.error("Error disconnecting Instagram:", err);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isInstagramConnected = !!(profile?.unipile_account_id || profile?.instagram_business_account_id);

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account, integrations, and AI preferences.
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>
            Your personal account information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={authUser?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : profileSaved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {profileSaved ? "Saved!" : "Save Profile"}
          </Button>
        </CardFooter>
      </Card>

      {/* Instagram Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Instagram className="h-5 w-5" />
            Instagram Connection
          </CardTitle>
          <CardDescription>
            Manage your Instagram business account connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              {isInstagramConnected ? (
                <Badge variant="success">Connected</Badge>
              ) : (
                <Badge variant="muted">Not Connected</Badge>
              )}
            </div>
            {isInstagramConnected && (
              <span className="text-xs text-muted-foreground">
                {profile?.instagram_username
                  ? `@${profile.instagram_username}`
                  : `Account: ${profile?.instagram_business_account_id || profile?.unipile_account_id}`}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              asChild
              variant={isInstagramConnected ? "outline" : "default"}
            >
              <a href="/api/auth/instagram" className="flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                {isInstagramConnected ? "Reconnect" : "Connect Instagram"}
              </a>
            </Button>
            {isInstagramConnected && (
              <Button
                variant="destructive"
                onClick={handleDisconnectInstagram}
                disabled={disconnecting}
              >
                {disconnecting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Disconnect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Calendly */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Calendly
          </CardTitle>
          <CardDescription>
            Your Calendly booking link. The AI will share this in DMs when a
            prospect is ready to book a call.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calendlyUrl">Booking Link</Label>
            <Input
              id="calendlyUrl"
              type="url"
              value={calendlyUrl}
              onChange={(e) => setCalendlyUrl(e.target.value)}
              placeholder="https://calendly.com/your-handle/30min"
            />
            {calendlyError ? (
              <p className="text-xs text-destructive">{calendlyError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Paste the full URL of the event type you want prospects to book
                (e.g. <code>https://calendly.com/your-handle/30min</code>).
              </p>
            )}
          </div>

          {calendlyUrl.trim() && !calendlyError && (
            <div className="flex items-center gap-2">
              <Badge variant="success">Link set</Badge>
              <a
                href={calendlyUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Preview <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveCalendly} disabled={savingCalendly}>
            {savingCalendly ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : calendlySaved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {calendlySaved ? "Saved!" : "Save Calendly Link"}
          </Button>
        </CardFooter>
      </Card>

      {/* Revenue tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Revenue Tracking
          </CardTitle>
          <CardDescription>
            Set your average deal value so the Analytics page can show real
            revenue from booked calls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="avgDealValue">Average Deal Value (USD)</Label>
            <Input
              id="avgDealValue"
              type="number"
              min={0}
              step="0.01"
              value={avgDealValue}
              onChange={(e) => setAvgDealValue(e.target.value)}
              placeholder="e.g. 500"
              className="w-48"
            />
            {dealValueError ? (
              <p className="text-xs text-destructive">{dealValueError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Revenue on the Analytics page = booked calls × this value.
                Leave blank to hide revenue KPIs.
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveDealValue} disabled={savingDealValue}>
            {savingDealValue ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : dealValueSaved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {dealValueSaved ? "Saved!" : "Save Deal Value"}
          </Button>
        </CardFooter>
      </Card>

      {/* Google Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            View your Google Calendar events alongside Calendly bookings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              {gcalConnected ? (
                <Badge variant="success">Connected</Badge>
              ) : (
                <Badge variant="muted">Not Connected</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              asChild
              variant={gcalConnected ? "outline" : "default"}
            >
              <a href="/api/auth/google-calendar" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {gcalConnected ? "Reconnect" : "Connect Google Calendar"}
              </a>
            </Button>
            {gcalConnected && (
              <Button
                variant="destructive"
                onClick={async () => {
                  setDisconnectingGcal(true);
                  try {
                    await supabase
                      .from("users")
                      .update({
                        google_calendar_access_token: null,
                        google_calendar_refresh_token: null,
                        google_calendar_token_expires_at: null,
                      })
                      .eq("id", authUser.id);
                    setGcalConnected(false);
                  } catch (err) {
                    console.error("Error disconnecting Google Calendar:", err);
                  } finally {
                    setDisconnectingGcal(false);
                  }
                }}
                disabled={disconnectingGcal}
              >
                {disconnectingGcal && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Disconnect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Settings
          </CardTitle>
          <CardDescription>
            Control how your AI agent behaves.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">AI Agent Active</p>
              <p className="text-xs text-muted-foreground">
                When enabled, the AI will automatically respond to new DMs.
              </p>
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
          </div>

          <Separator />

          <div className="space-y-2">
            <Label
              htmlFor="responseDelay"
              className="flex items-center gap-2"
            >
              <Clock className="h-3.5 w-3.5" />
              Response Delay (seconds)
            </Label>
            <Input
              id="responseDelay"
              type="number"
              min={1}
              max={120}
              step={1}
              value={responseDelay}
              onChange={(e) => setResponseDelay(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Add a delay (1–120 seconds) before the AI responds to feel more
              natural and comply with platform guidelines.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveAiSettings} disabled={savingAi}>
            {savingAi ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : aiSaved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {aiSaved ? "Saved!" : "Save AI Settings"}
          </Button>
        </CardFooter>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
            </div>
            <Dialog
              open={deleteOpen}
              onOpenChange={(open) => {
                setDeleteOpen(open);
                if (!open) {
                  setDeleteConfirmText("");
                  setDeleteError(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Account</DialogTitle>
                  <DialogDescription>
                    This will permanently delete your account, all conversations,
                    messages, bookings, and cancel your subscription. This action
                    cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 mt-2">
                  <Label htmlFor="delete-confirm">
                    Type <strong>DELETE</strong> to confirm
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    disabled={deleting}
                    autoComplete="off"
                  />
                  {deleteError && (
                    <p className="text-sm text-destructive">{deleteError}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== "DELETE" || deleting}
                  >
                    {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {deleting ? "Deleting..." : "Delete Account"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
