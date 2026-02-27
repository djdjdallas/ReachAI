"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Save,
  Check,
  User,
  Instagram,
  Bot,
  AlertTriangle,
  Clock,
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

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);

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
      const clampedDelay = Math.min(Math.max(Number(responseDelay) || 1, 1), 3);
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

  const handleDisconnectInstagram = async () => {
    setDisconnecting(true);
    try {
      await supabase
        .from("users")
        .update({
          instagram_token: null,
          instagram_user_id: null,
          instagram_page_id: null,
        })
        .eq("id", authUser.id);

      setProfile((prev) => ({
        ...prev,
        instagram_token: null,
        instagram_user_id: null,
        instagram_page_id: null,
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

  const isInstagramConnected = !!profile?.instagram_token;

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
            {profile?.instagram_user_id && (
              <span className="text-xs text-muted-foreground">
                ID: {profile.instagram_user_id}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              asChild
              variant={isInstagramConnected ? "outline" : "default"}
            >
              <a href="/api/auth/instagram">
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
              max={3}
              step={1}
              value={responseDelay}
              onChange={(e) => setResponseDelay(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Add a delay (1-3 seconds) before the AI responds to feel more
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
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Account</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. To delete your account and all
                    associated data, please contact our support team at{" "}
                    <strong>support@reachai.com</strong>. We will process your
                    request within 24 hours.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      window.location.href =
                        "mailto:support@reachai.com?subject=Account%20Deletion%20Request";
                    }}
                  >
                    Contact Support
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
