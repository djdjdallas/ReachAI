"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Send, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

function formatLocalDateTime(d) {
  // YYYY-MM-DDTHH:mm — the format datetime-local expects, in local timezone
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function timeAgo(iso) {
  if (!iso) return "";
  const now = new Date();
  const d = new Date(iso);
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NativeSendPage() {
  const supabase = createClient();

  const [handle, setHandle] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [dmText, setDmText] = useState("");
  const [sentAt, setSentAt] = useState(formatLocalDateTime(new Date()));

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // { type: "ok"|"err", text }

  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);

  async function loadRows() {
    setLoadingRows(true);
    try {
      const res = await fetch("/api/native-send", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setRows(data.rows || []);
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    loadRows();

    // Realtime: when a webhook (or backfill) sets matched_conversation_id,
    // refresh the table so the user sees their log flip from Waiting → Matched.
    const channel = supabase
      .channel("native_send_outbound_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "native_send_outbound" },
        () => loadRows()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatusMsg(null);

    if (!dmText.trim() || !handle.trim()) {
      setStatusMsg({ type: "err", text: "Handle and DM body are both required." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/native-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_handle: handle,
          recipient_ig_user_id: igUserId || null,
          dm_text: dmText,
          sent_at: new Date(sentAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: "err", text: data.error || "Failed to save." });
        return;
      }
      if (data.backfilled_conversation_id) {
        setStatusMsg({
          type: "ok",
          text: "Logged and linked to an existing reply — AI now has full context.",
        });
      } else {
        setStatusMsg({ type: "ok", text: "Logged — Clinchd will catch the reply." });
      }
      setHandle("");
      setIgUserId("");
      setDmText("");
      setSentAt(formatLocalDateTime(new Date()));
      loadRows();
    } catch (err) {
      setStatusMsg({ type: "err", text: err.message || "Network error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Native Send</h1>
        <p className="text-sm text-stone-500 mt-1">
          Log a cold DM you sent from native Instagram so Clinchd has full thread context
          when the reply lands.
        </p>
      </div>

      <Card className="p-6 bg-white rounded-3xl border border-stone-100">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="handle">Recipient handle</Label>
              <Input
                id="handle"
                placeholder="@tobiasyoung"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                disabled={saving}
                className="mt-1"
                autoComplete="off"
              />
              <p className="text-xs text-stone-400 mt-1">
                The IG handle you DM&apos;d. The leading @ is optional.
              </p>
            </div>
            <div>
              <Label htmlFor="ig_user_id">
                IG user ID <span className="text-stone-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="ig_user_id"
                placeholder=""
                value={igUserId}
                onChange={(e) => setIgUserId(e.target.value)}
                disabled={saving}
                className="mt-1"
                autoComplete="off"
              />
              <p className="text-xs text-stone-400 mt-1">
                If you know it, it makes matching exact. Otherwise leave blank.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="dm_text">DM you sent</Label>
            <Textarea
              id="dm_text"
              placeholder="Paste the exact DM you sent from Instagram."
              value={dmText}
              onChange={(e) => setDmText(e.target.value)}
              disabled={saving}
              rows={5}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="sent_at">When you sent it</Label>
              <Input
                id="sent_at"
                type="datetime-local"
                value={sentAt}
                onChange={(e) => setSentAt(e.target.value)}
                disabled={saving}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="bg-[#ff7e67] hover:bg-[#ff6b50] text-white">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Logging...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Log this DM
                  </>
                )}
              </Button>
            </div>
          </div>

          {statusMsg && (
            <div
              className={`text-sm rounded-xl px-4 py-3 ${
                statusMsg.type === "ok"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-rose-50 text-rose-700 border border-rose-100"
              }`}
            >
              {statusMsg.text}
            </div>
          )}
        </form>
      </Card>

      <Card className="p-6 bg-white rounded-3xl border border-stone-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-900">Recent native sends</h2>
          <span className="text-xs text-stone-400">{rows.length} logged</span>
        </div>

        {loadingRows ? (
          <div className="flex items-center gap-2 text-sm text-stone-400 py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-stone-400 py-6 text-center">
            No native sends logged yet. Log your first cold DM above.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {rows.map((row) => (
              <NativeSendRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function NativeSendRow({ row }) {
  const matched = !!row.matched_conversation_id;
  return (
    <div className="py-3 flex items-start gap-4">
      <div className="flex-shrink-0 mt-1">
        {matched ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <Clock className="h-5 w-5 text-stone-300" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-stone-900">
            @{row.recipient_handle || "(no handle)"}
          </span>
          <span className="text-stone-400">·</span>
          <span className="text-stone-400 text-xs">{timeAgo(row.sent_at)}</span>
        </div>
        <p className="text-sm text-stone-600 mt-1 line-clamp-2">{row.dm_text}</p>
        <div className="mt-1.5 text-xs">
          {matched ? (
            <Link
              href={`/conversations?thread=${row.matched_conversation_id}`}
              className="text-[#ff7e67] hover:underline"
            >
              View thread →
            </Link>
          ) : (
            <span className="text-stone-400">Waiting for reply</span>
          )}
        </div>
      </div>
    </div>
  );
}
