"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  ANSWER_MAX,
  KNOWLEDGE_TOTAL_CAP,
  KNOWLEDGE_TYPES,
  QUESTION_MAX,
  entryChars,
  totalChars,
} from "@/lib/knowledge/limits";
import { KNOWLEDGE_TEMPLATES } from "@/lib/knowledge/templates";

const CORAL = "#ff7e67";
const TYPE_LABELS = { faq: "FAQ", policy: "Policy", note: "Note" };

// Placeholder text for template questions, looked up by question.
const HINTS = Object.fromEntries(
  Object.values(KNOWLEDGE_TEMPLATES).flatMap((t) =>
    t.entries.map((e) => [e.question.toLowerCase(), e.hint])
  )
);

function formatPrice(cents) {
  if (typeof cents !== "number") return null;
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

async function api(method, body, query = "") {
  const res = await fetch(`/api/settings/knowledge${query}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

export default function KnowledgeEditor() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // Server rows, plus local edits keyed by id.
  const [entries, setEntries] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [rowState, setRowState] = useState({}); // id -> {saving, error}
  const [offer, setOffer] = useState(null);
  const [bookingLink, setBookingLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api("GET");
      setEntries(data.entries || []);
      setOffer(data.offer || null);
      setBookingLink(data.bookingLink || "");
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const merged = useMemo(
    () => entries.map((e) => ({ ...e, ...(drafts[e.id] || {}) })),
    [entries, drafts]
  );
  const used = totalChars(merged);
  const pct = Math.min(100, Math.round((used / KNOWLEDGE_TOTAL_CAP) * 100));
  const over = used > KNOWLEDGE_TOTAL_CAP;

  const setRow = (id, patch) =>
    setRowState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const editField = (id, field, value) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  async function save(id, extra = {}) {
    const entry = merged.find((e) => e.id === id);
    if (!entry) return;
    setRow(id, { saving: true, error: null });
    try {
      const { entry: saved } = await api("PATCH", {
        id,
        type: entry.type,
        question: entry.question,
        answer: entry.answer,
        enabled: entry.enabled,
        ...extra,
      });
      setEntries((prev) => prev.map((e) => (e.id === id ? saved : e)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setRow(id, { saving: false });
    } catch (err) {
      setRow(id, { saving: false, error: err.message });
    }
  }

  async function addEntry() {
    setBusy(true);
    setPageError(null);
    try {
      const { entry } = await api("POST", {
        entry: { type: "faq", question: "", answer: "", enabled: false },
      });
      setEntries((prev) => [...prev, entry]);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addTemplate(key) {
    setBusy(true);
    setPageError(null);
    try {
      await api("POST", { template: key });
      await load();
    } catch (err) {
      setPageError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function move(id, dir) {
    const i = entries.findIndex((e) => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= entries.length) return;
    const next = [...entries];
    [next[i], next[j]] = [next[j], next[i]];
    setEntries(next);
    try {
      await api("PATCH", { order: next.map((e) => e.id) });
    } catch (err) {
      setPageError(err.message);
      load();
    }
  }

  async function confirmDelete() {
    const id = deleteId;
    setBusy(true);
    try {
      await api("DELETE", null, `?id=${encodeURIComponent(id)}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setDeleteId(null);
    } catch (err) {
      setPageError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const price = formatPrice(offer?.offer_price_cents);

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-5 w-5" style={{ color: CORAL }} />
          <h1 className="text-2xl font-bold">Business knowledge</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          FAQs, policies and details the AI can answer from in your DMs. It
          reads every entry that&apos;s turned on before each reply. If a lead
          asks about a price, availability or a policy that isn&apos;t covered
          here, the AI tells them it&apos;ll check and hands the conversation
          to you. Medical and health questions always come to you.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p className="text-sm">
          Anything here may be shown to leads. Don&apos;t include internal notes
          or margins.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {used.toLocaleString()} / {KNOWLEDGE_TOTAL_CAP.toLocaleString()} characters
            </span>
            <span className="text-xs text-muted-foreground">
              Only entries that are turned on count
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: over ? "#dc2626" : pct > 85 ? "#d97706" : CORAL,
              }}
            />
          </div>
          {over && (
            <p className="text-xs text-red-600">
              Over the limit. Shorten or turn off an entry before saving.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">From your offer</CardTitle>
          <CardDescription>
            The AI already knows these. Edit them in Your Offer, not here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {offer ? (
            <>
              <p>
                <span className="text-muted-foreground">Offer:</span>{" "}
                {offer.offer_name || "Untitled offer"}
              </p>
              <p>
                <span className="text-muted-foreground">Price:</span>{" "}
                {price || "Not set"}
              </p>
              <p className="truncate">
                <span className="text-muted-foreground">Offer page:</span>{" "}
                {offer.offer_url || "Not set"}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No offer set up yet.</p>
          )}
          <p className="truncate">
            <span className="text-muted-foreground">Booking link:</span>{" "}
            {bookingLink || "Not connected"}
          </p>
          <a
            href="/settings/offer"
            className="inline-flex items-center gap-1 pt-2 text-sm font-medium"
            style={{ color: CORAL }}
          >
            Edit your offer <ChevronRight className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={addEntry} disabled={busy || loading}>
          <Plus className="h-4 w-4 mr-1" /> Add entry
        </Button>
        {Object.entries(KNOWLEDGE_TEMPLATES).map(([key, t]) => (
          <Button
            key={key}
            variant="outline"
            onClick={() => addTemplate(key)}
            disabled={busy || loading}
          >
            Add {t.label.toLowerCase()} starter
          </Button>
        ))}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground -mt-4">
        Starters add questions as drafts that are turned off. Fill in your
        answer, then turn each one on.
      </p>
      {pageError && <p className="text-sm text-red-600">{pageError}</p>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : merged.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No entries yet. Add one, or start from a template above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {merged.map((e, idx) => {
            const dirty = Boolean(drafts[e.id]);
            const st = rowState[e.id] || {};
            const hint = HINTS[(e.question || "").trim().toLowerCase()];
            return (
              <Card key={e.id} className={e.enabled ? "" : "opacity-90 border-dashed"}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Entry type"
                        value={e.type}
                        onChange={(ev) => editField(e.id, "type", ev.target.value)}
                        className="h-8 rounded-md border bg-background px-2 text-sm"
                      >
                        {KNOWLEDGE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">
                        {e.enabled ? `${entryChars(e).toLocaleString()} characters` : "Off, not used in replies"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Move up"
                        disabled={idx === 0 || dirty}
                        onClick={() => move(e.id, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Move down"
                        disabled={idx === merged.length - 1 || dirty}
                        onClick={() => move(e.id, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete entry"
                        onClick={() => setDeleteId(e.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-2 pl-2">
                        <Label htmlFor={`on-${e.id}`} className="text-xs">
                          {e.enabled ? "On" : "Off"}
                        </Label>
                        <Switch
                          id={`on-${e.id}`}
                          checked={e.enabled}
                          disabled={st.saving}
                          onCheckedChange={(v) => save(e.id, { enabled: v })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`q-${e.id}`}>
                      {e.type === "note" ? "Title (optional)" : "Question"}
                    </Label>
                    <Input
                      id={`q-${e.id}`}
                      value={e.question}
                      maxLength={QUESTION_MAX}
                      onChange={(ev) => editField(e.id, "question", ev.target.value)}
                      placeholder={e.type === "policy" ? "e.g. What's your refund policy?" : "e.g. Do you offer payment plans?"}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`a-${e.id}`}>Answer</Label>
                    <Textarea
                      id={`a-${e.id}`}
                      value={e.answer}
                      maxLength={ANSWER_MAX}
                      rows={3}
                      onChange={(ev) => editField(e.id, "answer", ev.target.value)}
                      placeholder={hint || "Write the answer the way you'd want a lead to hear it."}
                    />
                    <p className="text-[11px] text-muted-foreground text-right">
                      {(e.answer || "").length} / {ANSWER_MAX}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-red-600">{st.error || ""}</p>
                    {dirty && (
                      <Button size="sm" onClick={() => save(e.id)} disabled={st.saving}>
                        {st.saving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        Save
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this entry?"
        description="The AI stops using it right away. This can't be undone."
        confirmText="Delete"
        loading={busy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
