"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Bell,
  MessageSquare,
  RefreshCw,
  Mic2,
  Trash2,
  X,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // Profile
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // AI Settings
  const [aiMode, setAiMode] = useState("active");
  const [togglingAi, setTogglingAi] = useState(false);
  const [aiModeError, setAiModeError] = useState(null);
  const [responseDelay, setResponseDelay] = useState(2);
  const [savingAi, setSavingAi] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);

  // Instagram
  const [disconnecting, setDisconnecting] = useState(false);
  const [showInstagramDenied, setShowInstagramDenied] = useState(false);

  // Calendly status messages
  const [calendlyNotice, setCalendlyNotice] = useState(null);

  useEffect(() => {
    if (searchParams.get("instagram") === "denied") {
      setShowInstagramDenied(true);
      router.replace("/settings", { scroll: false });
    }
    if (searchParams.get("calendly") === "connected") {
      const warning = searchParams.get("warning");
      setCalendlyNotice({
        kind: warning ? "warning" : "success",
        warning,
      });
      router.replace("/settings", { scroll: false });
    }
    const err = searchParams.get("error");
    if (err && err.startsWith("calendly_")) {
      setCalendlyNotice({ kind: "error", error: err });
      router.replace("/settings", { scroll: false });
    }
  }, [searchParams, router]);

  // Calendar integrations
  const [gcalConnected, setGcalConnected] = useState(false);
  const [disconnectingGcal, setDisconnectingGcal] = useState(false);
  const [syncingGcal, setSyncingGcal] = useState(false);

  // Calendly
  const [calendlyConnected, setCalendlyConnected] = useState(false);
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [disconnectingCalendly, setDisconnectingCalendly] = useState(false);
  const [confirmDisconnectCalendlyOpen, setConfirmDisconnectCalendlyOpen] = useState(false);

  // Revenue / deal value
  const [avgDealValue, setAvgDealValue] = useState("");
  const [savingDealValue, setSavingDealValue] = useState(false);
  const [dealValueSaved, setDealValueSaved] = useState(false);
  const [dealValueError, setDealValueError] = useState(null);

  // Notifications
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [phoneError, setPhoneError] = useState(null);
  const [notifyHotLeadsEmail, setNotifyHotLeadsEmail] = useState(true);
  const [notifyBookingsEmail, setNotifyBookingsEmail] = useState(true);
  const [notifyHotLeadsSms, setNotifyHotLeadsSms] = useState(false);
  const [notifyBookingsSms, setNotifyBookingsSms] = useState(false);

  // Voice profile
  const [voiceProfile, setVoiceProfile] = useState(null);
  const [clearingVoice, setClearingVoice] = useState(false);

  // Confirmation dialogs
  const [confirmDisconnectInstagramOpen, setConfirmDisconnectInstagramOpen] =
    useState(false);
  const [confirmClearVoiceOpen, setConfirmClearVoiceOpen] = useState(false);

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
        setAiMode(userProfile.ai_mode || "active");
        setResponseDelay(userProfile.response_delay || 2);
        setGcalConnected(!!userProfile.google_calendar_refresh_token);
        setCalendlyConnected(!!userProfile.calendly_refresh_token);
        setCalendlyUrl(userProfile.calendly_url || "");
        setAvgDealValue(
          userProfile.avg_deal_value != null
            ? String(userProfile.avg_deal_value)
            : ""
        );
        setPhoneNumber(userProfile.phone_number || "");
        setNotifyHotLeadsEmail(userProfile.notify_hot_leads_email ?? true);
        setNotifyBookingsEmail(userProfile.notify_bookings_email ?? true);
        setNotifyHotLeadsSms(userProfile.notify_hot_leads_sms ?? false);
        setNotifyBookingsSms(userProfile.notify_bookings_sms ?? false);
        if (userProfile.voice_profile) {
          setVoiceProfile(userProfile.voice_profile);
        }
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

  const handleSetAiMode = async (newMode) => {
    setTogglingAi(true);
    setAiModeError(null);
    const previousMode = aiMode;
    setAiMode(newMode);

    try {
      const res = await fetch("/api/users/ai-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiMode(previousMode);
        setAiModeError(data?.error || "Failed to update agent mode.");
        return;
      }

      // TODO(post-launch): Remove after one release cycle. This branch
      // was previously written to mop up invisible manual-reply pauses
      // (ai_paused=true with null reason). That code path was removed
      // in <commit-sha>. Kept temporarily as defensive cleanup for any
      // legacy rows that escape the one-shot SQL migration.
      if (newMode === "active") {
        await supabase
          .from("conversations")
          .update({ ai_paused: false, ai_pause_reason: null })
          .eq("user_id", authUser.id)
          .eq("ai_paused", true)
          .is("ai_pause_reason", null);
      }

      posthog.capture("ai_agent_toggled", { mode: newMode, previous_mode: previousMode });
    } catch (err) {
      console.error("Error setting AI mode:", err);
      setAiMode(previousMode);
      setAiModeError("Failed to update agent mode.");
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

  const handleDisconnectCalendly = async () => {
    setDisconnectingCalendly(true);
    try {
      const res = await fetch("/api/auth/calendly/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Disconnect failed");
      posthog.capture("calendly_disconnected");
      setCalendlyConnected(false);
      setCalendlyUrl("");
      setProfile((prev) => ({ ...prev, calendly_url: null }));
      setConfirmDisconnectCalendlyOpen(false);
    } catch (err) {
      console.error("Error disconnecting Calendly:", err);
    } finally {
      setDisconnectingCalendly(false);
    }
  };

  const handleSavePhone = async () => {
    setPhoneError(null);
    const trimmed = phoneNumber.trim().replace(/[^\d+]/g, "");

    if (trimmed && !/^\+[1-9]\d{6,14}$/.test(trimmed)) {
      setPhoneError(
        "Enter a valid phone number with country code (e.g. +15551234567)."
      );
      return;
    }

    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ phone_number: trimmed || null })
        .eq("id", authUser.id);

      if (error) throw error;

      setPhoneNumber(trimmed);
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 2000);

      // If phone was cleared, turn off SMS toggles
      if (!trimmed) {
        setNotifyHotLeadsSms(false);
        setNotifyBookingsSms(false);
        await supabase
          .from("users")
          .update({ notify_hot_leads_sms: false, notify_bookings_sms: false })
          .eq("id", authUser.id);
      }
    } catch (err) {
      console.error("Error saving phone:", err);
      setPhoneError("Failed to save. Please try again.");
    } finally {
      setSavingPhone(false);
    }
  };

  const handleToggleNotification = async (field, value) => {
    // Optimistic update
    const setters = {
      notify_hot_leads_email: setNotifyHotLeadsEmail,
      notify_bookings_email: setNotifyBookingsEmail,
      notify_hot_leads_sms: setNotifyHotLeadsSms,
      notify_bookings_sms: setNotifyBookingsSms,
    };
    const setter = setters[field];
    if (!setter) return;

    setter(value);
    try {
      const { error } = await supabase
        .from("users")
        .update({ [field]: value })
        .eq("id", authUser.id);

      if (error) throw error;
    } catch (err) {
      console.error("Error saving notification pref:", err);
      setter(!value); // revert
    }
  };

  const handleClearVoice = async () => {
    setClearingVoice(true);
    try {
      await supabase
        .from("users")
        .update({ voice_profile: null })
        .eq("id", authUser.id);
      setVoiceProfile(null);
      posthog.capture("voice_profile_cleared", { source: "settings" });
      setConfirmClearVoiceOpen(false);
    } catch (err) {
      console.error("Error clearing voice profile:", err);
    } finally {
      setClearingVoice(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    setDisconnecting(true);
    try {
      // Call backend to un-subscribe the webhook + clear DB
      await fetch("/api/auth/instagram/disconnect", { method: "POST" });

      posthog.capture("instagram_disconnected");
      setProfile((prev) => ({
        ...prev,
        instagram_business_account_id: null,
      }));
      setConfirmDisconnectInstagramOpen(false);
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

  const isInstagramConnected = !!profile?.instagram_business_account_id;

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account, integrations, and agent preferences.
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

      {showInstagramDenied && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p className="flex-1 text-sm">
            Instagram connection was cancelled. Connect your account to start
            receiving DMs from your followers.
          </p>
          <button
            type="button"
            onClick={() => setShowInstagramDenied(false)}
            aria-label="Dismiss"
            className="rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
                  : `Account: ${profile?.instagram_business_account_id}`}
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
                onClick={() => setConfirmDisconnectInstagramOpen(true)}
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
            Connect Calendly to share your booking link in DMs and track
            bookings automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {calendlyNotice?.kind === "success" && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-100">
              Calendly connected. Bookings will sync automatically.
            </div>
          )}
          {calendlyNotice?.kind === "warning" &&
            calendlyNotice.warning === "calendly_plan_limit" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                Connected, but your Calendly plan doesn&apos;t support webhooks.
                Booking link will work, but new bookings won&apos;t auto-sync.
                Upgrade Calendly to Standard+ to enable booking sync.
              </div>
            )}
          {calendlyNotice?.kind === "error" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Couldn&apos;t connect Calendly. Please try again.
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              {calendlyConnected ? (
                <Badge variant="success">Connected</Badge>
              ) : (
                <Badge variant="muted">Not Connected</Badge>
              )}
            </div>
            {calendlyConnected && calendlyUrl && (
              <a
                href={calendlyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Preview link <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              asChild
              variant={calendlyConnected ? "outline" : "default"}
            >
              <a href="/api/auth/calendly" className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                {calendlyConnected ? "Reconnect" : "Connect Calendly"}
              </a>
            </Button>
            {calendlyConnected && (
              <Button
                variant="destructive"
                onClick={() => setConfirmDisconnectCalendlyOpen(true)}
                disabled={disconnectingCalendly}
              >
                {disconnectingCalendly && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Disconnect
              </Button>
            )}
          </div>
        </CardContent>
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
                variant="outline"
                onClick={async () => {
                  setSyncingGcal(true);
                  try {
                    await fetch("/api/google-calendar/events");
                  } catch (err) {
                    console.error("Error syncing Google Calendar:", err);
                  } finally {
                    setSyncingGcal(false);
                  }
                }}
                disabled={syncingGcal}
              >
                {syncingGcal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync Now
              </Button>
            )}
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

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Get notified by email when we flag important lead activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Hot Lead Alerts</p>
              <p className="text-xs text-muted-foreground">
                Get emailed when we flag a highly interested lead.
              </p>
            </div>
            <Switch
              checked={notifyHotLeadsEmail}
              onCheckedChange={(v) =>
                handleToggleNotification("notify_hot_leads_email", v)
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Booking Confirmation</p>
              <p className="text-xs text-muted-foreground">
                Get emailed when a discovery call gets booked.
              </p>
            </div>
            <Switch
              checked={notifyBookingsEmail}
              onCheckedChange={(v) =>
                handleToggleNotification("notify_bookings_email", v)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* SMS Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Notifications
          </CardTitle>
          <CardDescription>
            Get text message alerts for urgent lead activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <div className="flex gap-2">
              <Input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-56"
              />
              <Button
                onClick={handleSavePhone}
                disabled={savingPhone}
                variant="outline"
                size="sm"
              >
                {savingPhone ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : phoneSaved ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {phoneSaved ? "Saved!" : "Save"}
              </Button>
            </div>
            {phoneError ? (
              <p className="text-xs text-destructive">{phoneError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Include country code (e.g. +15551234567). Required for SMS
                alerts.
              </p>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Hot Lead SMS</p>
              <p className="text-xs text-muted-foreground">
                Text me when a lead becomes interested.
              </p>
            </div>
            <Switch
              checked={notifyHotLeadsSms}
              onCheckedChange={(v) =>
                handleToggleNotification("notify_hot_leads_sms", v)
              }
              disabled={!phoneNumber.trim()}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Booking SMS</p>
              <p className="text-xs text-muted-foreground">
                Text me when a lead books a discovery call.
              </p>
            </div>
            <Switch
              checked={notifyBookingsSms}
              onCheckedChange={(v) =>
                handleToggleNotification("notify_bookings_sms", v)
              }
              disabled={!phoneNumber.trim()}
            />
          </div>
          {!phoneNumber.trim() && (
            <p className="text-xs text-muted-foreground italic">
              Add a phone number above to enable SMS alerts.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Agent Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agent Settings
          </CardTitle>
          <CardDescription>
            Control how your agent behaves.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Agent Mode</p>
              <p className="text-xs text-muted-foreground">
                {aiMode === "active" && "Agent is responding to DMs automatically."}
                {aiMode === "handoff" && "Messages are logged but the agent won\u2019t reply. You can reply manually."}
                {aiMode === "off" && "Complete silence. No messages logged, no replies sent."}
              </p>
            </div>
            <Tabs value={aiMode} onValueChange={handleSetAiMode}>
              <TabsList>
                <TabsTrigger
                  value="active"
                  disabled={togglingAi}
                  className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700"
                >
                  Active
                </TabsTrigger>
                <TabsTrigger
                  value="handoff"
                  disabled={togglingAi}
                  className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700"
                >
                  Handoff
                </TabsTrigger>
                <TabsTrigger
                  value="off"
                  disabled={togglingAi}
                  className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700"
                >
                  Off
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {aiModeError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {aiModeError}{" "}
                <a href="/script-builder" className="underline font-medium">
                  Complete setup →
                </a>
              </span>
            </div>
          )}

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
              Add a delay (1–120 seconds) before the agent responds to feel more
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
            {aiSaved ? "Saved!" : "Save Settings"}
          </Button>
        </CardFooter>
      </Card>

      {/* Voice Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic2 className="h-5 w-5" />
            Voice Profile
          </CardTitle>
          <CardDescription>
            Your voice profile controls how DM replies sound. Train or
            re-train it in the Script Builder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {voiceProfile?.status === "ready" ? (
            <>
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <p className="text-sm italic text-foreground">
                  &ldquo;{voiceProfile.voice_summary}&rdquo;
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {voiceProfile.voice_traits?.tone && (
                    <div>
                      <span className="font-medium text-muted-foreground">Tone:</span>{" "}
                      {voiceProfile.voice_traits.tone}
                    </div>
                  )}
                  {voiceProfile.voice_traits?.formality && (
                    <div>
                      <span className="font-medium text-muted-foreground">Formality:</span>{" "}
                      {voiceProfile.voice_traits.formality}
                    </div>
                  )}
                  {voiceProfile.voice_traits?.emoji_usage && (
                    <div>
                      <span className="font-medium text-muted-foreground">Emojis:</span>{" "}
                      {voiceProfile.voice_traits.emoji_usage}
                    </div>
                  )}
                  {voiceProfile.voice_traits?.personality && (
                    <div>
                      <span className="font-medium text-muted-foreground">Personality:</span>{" "}
                      {voiceProfile.voice_traits.personality}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href="/script-builder" className="flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Re-train Voice
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClearVoiceOpen(true)}
                  disabled={clearingVoice}
                  className="text-muted-foreground"
                >
                  {clearingVoice ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Clear Profile
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                No voice profile set up yet. We'll use generic writing
                rules for DM replies.
              </p>
              <Button asChild size="sm">
                <a href="/script-builder" className="flex items-center gap-2">
                  <Mic2 className="h-4 w-4" />
                  Set Up Voice Profile
                </a>
              </Button>
            </div>
          )}
        </CardContent>
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

      <ConfirmDialog
        open={confirmDisconnectInstagramOpen}
        onOpenChange={setConfirmDisconnectInstagramOpen}
        title="Disconnect Instagram?"
        description="ReachAI will stop responding to DMs on your Instagram account. You can reconnect anytime."
        confirmText="Disconnect"
        loading={disconnecting}
        onConfirm={handleDisconnectInstagram}
      />

      <ConfirmDialog
        open={confirmClearVoiceOpen}
        onOpenChange={setConfirmClearVoiceOpen}
        title="Clear voice profile?"
        description="Your trained voice profile will be removed. You'll need to re-train it to restore personalization."
        confirmText="Clear"
        loading={clearingVoice}
        onConfirm={handleClearVoice}
      />

      <ConfirmDialog
        open={confirmDisconnectCalendlyOpen}
        onOpenChange={setConfirmDisconnectCalendlyOpen}
        title="Disconnect Calendly?"
        description="Clinchd will stop syncing bookings and remove your booking link from DMs. You can reconnect anytime."
        confirmText="Disconnect"
        loading={disconnectingCalendly}
        onConfirm={handleDisconnectCalendly}
      />
    </div>
  );
}
