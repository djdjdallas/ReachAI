"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Tag,
  Link2,
} from "lucide-react";

const CORAL = "#ff7e67";

function listToText(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.filter((s) => typeof s === "string" && s.trim()).join(", ");
}

function textToList(text) {
  if (typeof text !== "string") return [];
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function centsToDollars(cents) {
  if (typeof cents !== "number") return "";
  return (cents / 100).toFixed(2);
}

function dollarsToCents(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

export default function OfferForm({ initialOffer }) {
  const [offerName, setOfferName] = useState(initialOffer?.offer_name || "");
  const [priceDollars, setPriceDollars] = useState(
    centsToDollars(initialOffer?.offer_price_cents)
  );
  const [offerUrl, setOfferUrl] = useState(initialOffer?.offer_url || "");
  const [idealCustomer, setIdealCustomer] = useState(
    initialOffer?.ideal_customer || ""
  );
  const [objections, setObjections] = useState(
    listToText(initialOffer?.objections)
  );
  const [questions, setQuestions] = useState(
    listToText(initialOffer?.qualification_questions)
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [imported, setImported] = useState(false);
  // Extracted fields the offer form has no inputs for (creator_offers has no
  // promise/FAQ columns) — shown read-only so the coach can copy anything
  // useful into the fields above before saving.
  const [importExtras, setImportExtras] = useState(null);

  async function handleImport() {
    const url = importUrl.trim();
    if (!url || importing) return;

    // Importing overwrites the fields below. If the coach has already typed
    // anything, confirm before replacing it so we never silently lose input.
    const hasExistingInput = [
      offerName,
      priceDollars,
      idealCustomer,
      objections,
      questions,
    ].some((v) => typeof v === "string" && v.trim());
    if (
      hasExistingInput &&
      !window.confirm(
        "This will replace what you've already entered below with details from the page. Continue?"
      )
    ) {
      return;
    }

    setImporting(true);
    setImportError(null);
    setImported(false);
    setImportExtras(null);

    try {
      const res = await fetch("/api/offers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(data.message || data.error || "Import failed. Please try again.");
        return;
      }

      const draft = data.draft || {};
      // Prefill ONLY — nothing is saved until the coach clicks "Save offer".
      if (draft.offer_name) setOfferName(draft.offer_name);
      if (
        typeof draft.price === "number" &&
        (!draft.currency || draft.currency === "USD")
      ) {
        setPriceDollars(draft.price.toFixed(2));
      }
      setOfferUrl(data.source_url || url);
      if (draft.target_audience) setIdealCustomer(draft.target_audience);
      if (Array.isArray(draft.objections) && draft.objections.length > 0) {
        setObjections(listToText(draft.objections));
      }
      if (
        Array.isArray(draft.qualification_questions) &&
        draft.qualification_questions.length > 0
      ) {
        setQuestions(listToText(draft.qualification_questions));
      }

      const faqs = Array.isArray(draft.faqs) ? draft.faqs : [];
      if (draft.promise || draft.delivery_format || faqs.length > 0) {
        setImportExtras({
          promise: draft.promise || "",
          deliveryFormat: draft.delivery_format || "",
          faqs,
        });
      }
      setImported(true);
      setSaved(false);
    } catch {
      setImportError("Network error. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  async function handleSave(e) {
    e?.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const payload = {
      offer_name: offerName.trim() || null,
      offer_price_cents: dollarsToCents(priceDollars),
      offer_url: offerUrl.trim() || null,
      ideal_customer: idealCustomer.trim() || null,
      objections: textToList(objections),
      qualification_questions: textToList(questions),
    };

    if (!payload.offer_name) {
      setError("Offer name is required.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed.");
      } else {
        setSaved(true);
      }
    } catch (err) {
      setError(err.message || "Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Tag className="h-5 w-5" style={{ color: CORAL }} />
          <h1 className="text-2xl font-bold">Your Offer</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          The classifier uses this to judge whether a comment is a real
          purchase signal versus general engagement. Keep it accurate.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-4 w-4" style={{ color: CORAL }} />
            Import from URL
          </CardTitle>
          <CardDescription>
            Paste the link to your sales or offer page and we&apos;ll prefill
            the fields below for you to review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://yoursite.com/offer"
              disabled={importing}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleImport();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleImport}
              disabled={importing || !importUrl.trim()}
              className="shrink-0"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Import from URL
                </>
              )}
            </Button>
          </div>

          {importError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {importError}
            </div>
          )}
          {imported && !importError && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              Imported — review before saving.
            </div>
          )}

          {imported && importExtras && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">
                Also found on your page — copy anything useful into the fields
                below (these aren&apos;t saved with your offer):
              </p>
              {importExtras.promise && (
                <p>
                  <span className="font-medium">Core promise:</span>{" "}
                  {importExtras.promise}
                </p>
              )}
              {importExtras.deliveryFormat && (
                <p>
                  <span className="font-medium">Delivery:</span>{" "}
                  {importExtras.deliveryFormat}
                </p>
              )}
              {importExtras.faqs.length > 0 && (
                <div className="space-y-1">
                  <p className="font-medium">FAQs:</p>
                  {importExtras.faqs.map((faq, i) => (
                    <p key={i}>
                      <span className="font-medium">Q:</span> {faq.q}{" "}
                      <span className="font-medium">A:</span> {faq.a}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Offer details</CardTitle>
            <CardDescription>
              One offer per account. Saving this replaces any previous offer
              attached to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="offer_name">Offer name</Label>
              <Input
                id="offer_name"
                value={offerName}
                onChange={(e) => setOfferName(e.target.value)}
                placeholder="6-Week Sprint Program"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                  placeholder="497.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer_url">Offer URL</Label>
                <Input
                  id="offer_url"
                  type="url"
                  value={offerUrl}
                  onChange={(e) => setOfferUrl(e.target.value)}
                  placeholder="https://clinchd.io/sprint"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ideal_customer">Ideal customer</Label>
              <Textarea
                id="ideal_customer"
                rows={3}
                value={idealCustomer}
                onChange={(e) => setIdealCustomer(e.target.value)}
                placeholder="Runners training for a half-marathon who want a structured plan."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objections">
                Common objections{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (comma-separated)
                </span>
              </Label>
              <Textarea
                id="objections"
                rows={2}
                value={objections}
                onChange={(e) => setObjections(e.target.value)}
                placeholder="too expensive, not enough time, already have a coach"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="questions">
                Qualification questions{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (comma-separated)
                </span>
              </Label>
              <Textarea
                id="questions"
                rows={2}
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                placeholder="What's your current weekly mileage?, What race are you training for?"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}
            {saved && !error && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Saved. The classifier will use this offer immediately.
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={saving}
              className="text-white"
              style={{ backgroundColor: CORAL }}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save offer
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
