import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { exchangeCodeForToken } from "@/lib/instagram";
import { encryptToken, decryptToken } from "@/lib/token-utils";
import { getPostHogClient } from "@/lib/posthog-server";
import {
  REQUIRED_WEBHOOK_FIELDS,
  missingWebhookFields,
} from "@/lib/instagram-webhook-fields";
import { sendOpsReconnectDigest } from "@/lib/tokens/reconnect";
import { sendBusinessEventAlert } from "@/lib/alerts/business-events";

export async function GET(request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const { searchParams } = new URL(request.url);
    const error = searchParams.get("error");
    const code = searchParams.get("code");

    // Handle user denial / missing code before anything else. Meta sends
    // `error=access_denied` (sometimes `user_denied` / `user_denied_app`)
    // when the user cancels the consent dialog, and a stray hit to this URL
    // with no params shouldn't blow up either. Treat all of these as a
    // cancelled connection — not an error — and bounce the user to settings
    // with a friendly banner.
    if (error || !code) {
      console.log(
        "[ig-callback] OAuth denied/aborted:",
        error || "no_code"
      );
      getPostHogClient().capture({
        distinctId: "anonymous",
        event: "instagram_connection_failed",
        properties: { reason: "oauth_denied", error: error || "no_code" },
      });
      return redirectClearingAuthCookies(
        `${baseUrl}/settings?instagram=denied`
      );
    }

    const state = searchParams.get("state");

    // Verify CSRF state
    const storedState = request.cookies.get("oauth_state")?.value;
    if (!state || !storedState || state !== storedState) {
      console.error("OAuth state mismatch");
      getPostHogClient().capture({
        distinctId: "anonymous",
        event: "instagram_connection_failed",
        properties: { reason: "invalid_state" },
      });
      return redirectClearingAuthCookies(
        `${baseUrl}/onboarding?step=1&error=invalid_state`
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return redirectClearingAuthCookies(`${baseUrl}/login?error=unauthorized`);
    }

    const admin = getSupabaseAdmin();

    // Check whether the user has already completed onboarding so we can
    // route reconnections to /settings instead of back into the funnel.
    // Also capture the PRIOR Instagram identity so the founder alert below
    // can call out an account swap (the July 14 incident) loudly.
    const { data: profile } = await admin
      .from("users")
      .select(
        "onboarding_completed, instagram_business_account_id, instagram_username, meta_page_access_token"
      )
      .eq("id", user.id)
      .single();
    const successRedirect = profile?.onboarding_completed
      ? `${baseUrl}/settings`
      : `${baseUrl}/onboarding?step=2`;

    // ── Instagram Login OAuth path ───────────────────────────────────
    // `code` and `error` were validated at the top of the handler.
    // Exchange code for long-lived token + Instagram user ID

    const { accessToken, expiresIn, userId } = await exchangeCodeForToken(code);
    void userId;

    // Fetch the Instagram Business Account ID (IGBA ID) — the 17841… format
    // that Meta Dashboard shows and that the webhook fires with.
    //
    // IMPORTANT: /me?fields=id returns the Instagram-Scoped User ID (the short
    // 269… format, per-app). The actual IGBA ID lives in the `user_id` field
    // when you request it explicitly. We query both so the logs make the
    // difference obvious if Meta ever changes this again.
    let igbaId = null;
    var igUsername = null;
    try {
      const meRes = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=id,user_id,username&access_token=${accessToken}`
      );
      const meData = await meRes.json();

      if (meData.user_id) {
        igbaId = meData.user_id;
      }
      // No fallback to meData.id — that is the IGSID, which will never match
      // the webhook `recipient.id`. Better to fail the connect and let the
      // user retry than silently save a broken account.
      igUsername = meData.username || null;
    } catch (err) {
      console.error("[ig-callback] Failed to fetch /me:", err?.message);
    }

    if (!igbaId) {
      console.error(
        "[ig-callback] No IGBA ID resolved from /me. Aborting token save and redirecting with error."
      );
      getPostHogClient().capture({
        distinctId: user.email || user.id,
        event: "instagram_connection_failed",
        properties: { reason: "no_igba_id" },
      });
      // Route already-onboarded coaches (reconnects) back to /settings so
      // the IG card's error banner can render. New coaches stay on the
      // onboarding step so the funnel doesn't break.
      const errorRedirect = profile?.onboarding_completed
        ? `${baseUrl}/settings?error=no_igba_id`
        : `${baseUrl}/onboarding?step=1&error=no_igba_id`;
      return redirectClearingAuthCookies(errorRedirect);
    }

    // ── IGBA-change guard ────────────────────────────────────────────
    // INVARIANT: the IGBA on an already-connected row can NEVER change
    // without an explicit human confirmation, in the same session, for
    // THIS SPECIFIC target account. On July 14 the browser's OAuth
    // session held a DIFFERENT Instagram account than intended and the
    // callback silently swapped the connection, producing a dark inbox
    // for ~2 days. A swap requires the user to re-initiate the connect
    // from the settings confirm banner, which sets the short-lived
    // httpOnly ig_switch_ack cookie (via /api/auth/instagram
    // ?confirm_switch=1&switch_to=<igba>) whose VALUE is the confirmed
    // target IGBA — the guard only accepts a swap to exactly that
    // account, so a leftover ack can never authorize a swap to some
    // other account the browser's Meta session happens to hold. The
    // cookie is single-use and cleared on every callback exit. No token
    // is ever carried through the confirm flow — the OAuth exchange
    // re-runs on the confirmed attempt. First connects (no prior IGBA)
    // and same-account reconnects (token refresh) proceed unguarded.
    const priorIgba = profile?.instagram_business_account_id || null;
    const isSwap = !!priorIgba && priorIgba !== igbaId;
    if (isSwap) {
      const ackTarget = request.cookies.get("ig_switch_ack")?.value || null;
      if (ackTarget !== igbaId) {
        console.warn(
          `[ig-callback] blocked IGBA swap without confirmation: ${priorIgba} -> ${igbaId} user=${user.id} ackTarget=${ackTarget || "none"}`
        );
        // Founder alert fires on the ATTEMPT, confirmed or not — marked
        // blocked so it reads differently from a completed switch.
        sendBusinessEventAlert("instagram_connected", {
          email: user.email,
          oldIgba: priorIgba,
          oldUsername: profile?.instagram_username || null,
          newIgba: igbaId,
          newUsername: igUsername || null,
          blocked: true,
        }).catch(console.error);
        getPostHogClient().capture({
          distinctId: user.email || user.id,
          event: "instagram_switch_blocked",
          properties: { old_igba: priorIgba, new_igba: igbaId },
        });
        // Not-yet-onboarded users can't reach /settings (middleware
        // bounces them to /onboarding), so route them to the onboarding
        // error banner instead of a confirm banner they'd never see.
        if (!profile?.onboarding_completed) {
          return redirectClearingAuthCookies(
            `${baseUrl}/onboarding?step=1&error=ig_switch_blocked`
          );
        }
        const params = new URLSearchParams({
          ig_switch: "blocked",
          from: profile?.instagram_username || priorIgba,
          to: igUsername || igbaId,
          to_igba: igbaId,
        });
        return redirectClearingAuthCookies(
          `${baseUrl}/settings?${params.toString()}`
        );
      }
    }

    // Save Instagram connection details
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { error: igSaveError } = await admin
      .from("users")
      .update({
        instagram_business_account_id: igbaId,
        instagram_username: igUsername || null,
        meta_page_access_token: encryptToken(accessToken),
        meta_user_access_token: encryptToken(accessToken),
        meta_token_expires_at: expiresAt,
        // A fresh connect supersedes any earlier dead-token flag. Without
        // this the refresh cron (which selects on the flag being false)
        // never touches the new token and the "reconnect needed" badge
        // stays lit after the coach has already reconnected.
        // meta_token_refreshed_at is left alone on purpose: the cron does not
        // select on it, and it is the only record of a past successful refresh.
        meta_reconnect_required: false,
        meta_reconnect_notified_at: null,
      })
      .eq("id", user.id);

    if (igSaveError) {
      console.error(
        "[ig-callback] users update failed:",
        igSaveError.code,
        igSaveError.message
      );
      // 23505 = the partial unique index rejected an IGBA that already
      // lives on ANOTHER user's row (same-user swaps are handled by the
      // guard above). Friendly message, never an unhandled 500. Tokens
      // were not saved, so skip webhook subscription and bail here.
      const errParam =
        igSaveError.code === "23505" ? "ig_already_connected" : "ig_save_failed";
      getPostHogClient().capture({
        distinctId: user.email || user.id,
        event: "instagram_connection_failed",
        properties: { reason: errParam, igba: igbaId },
      });
      const errorRedirect = profile?.onboarding_completed
        ? `${baseUrl}/settings?error=${errParam}`
        : `${baseUrl}/onboarding?step=1&error=${errParam}`;
      return redirectClearingAuthCookies(errorRedirect);
    }

    // Confirmed swap: best-effort unsubscribe of the OLD account's webhook
    // subscription using the pre-swap token still in memory, so Meta stops
    // firing events that would land as "[resolver:*] no user" forever —
    // the confirm banner promises this disconnect. Failures log and never
    // block the flow (the old token may already be revoked).
    if (isSwap && profile?.meta_page_access_token) {
      try {
        const oldToken = decryptToken(profile.meta_page_access_token);
        const unsubRes = await fetch(
          `https://graph.instagram.com/v21.0/${priorIgba}/subscribed_apps?access_token=${encodeURIComponent(oldToken)}`,
          { method: "DELETE" }
        );
        if (!unsubRes.ok) {
          const body = await unsubRes.text().catch(() => "");
          console.error(
            "[ig-callback] old-account unsubscribe failed — its webhook subscription may be orphaned:",
            unsubRes.status,
            body.slice(0, 200)
          );
        }
      } catch (err) {
        console.error(
          "[ig-callback] old-account unsubscribe threw — its webhook subscription may be orphaned:",
          err?.message
        );
      }
    }

    // Founder alert: first connect vs account CHANGED (old→new in the
    // subject). Fire-and-forget.
    sendBusinessEventAlert("instagram_connected", {
      email: user.email,
      oldIgba: priorIgba,
      oldUsername: profile?.instagram_username || null,
      newIgba: igbaId,
      newUsername: igUsername || null,
    }).catch(console.error);

    // Subscribe this IG business account to our webhook so Meta starts
    // firing incoming DM events, then read the subscription back and verify
    // Meta accepted every canonical field (see
    // src/lib/instagram-webhook-fields.js for field semantics). One
    // self-heal retry on mismatch. Non-blocking throughout: a degraded
    // subscription logs + alerts but never fails the OAuth flow — the user
    // is connected either way, and degraded webhooks beat no connection.
    try {
      await subscribeWebhookFields(igbaId, accessToken);
      // null = the verification GET itself failed (couldn't read back).
      let missing = await fetchMissingWebhookFields(igbaId, accessToken);
      if (missing === null || missing.length > 0) {
        await subscribeWebhookFields(igbaId, accessToken);
        missing = await fetchMissingWebhookFields(igbaId, accessToken);
      }
      if (missing === null || missing.length > 0) {
        const have =
          missing === null
            ? ["unknown"]
            : REQUIRED_WEBHOOK_FIELDS.filter((f) => !missing.includes(f));
        console.error(
          `[ig-callback] webhook subscription incomplete: have=[${have.join(",")}] want=[${REQUIRED_WEBHOOK_FIELDS.join(",")}] igba=${igbaId} user=${user.id}`
        );
        getPostHogClient().capture({
          distinctId: user.email || user.id,
          event: "webhook_subscription_incomplete",
          properties: {
            igba: igbaId,
            missing_fields: missing,
            verified: missing !== null,
          },
        });
        await sendOpsReconnectDigest([
          {
            label: user.email || user.id,
            provider: "meta",
            reason:
              missing === null
                ? "webhook subscription could not be verified after retry"
                : `webhook subscription incomplete after retry: missing ${missing.join(", ")}`,
          },
        ]);
      }
    } catch (subErr) {
      console.error(
        "[ig-callback] webhook subscribe/verify threw:",
        subErr?.message
      );
    }

    // Fire-and-forget: kick off voice profile auto-import. Do NOT await.
    // We want the user redirected immediately to onboarding; the import
    // runs in the background and the onboarding page polls for it.
    try {
      fetch(`${baseUrl}/api/instagram/auto-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
      }).catch((err) => {
        console.error(
          "[ig-callback] auto-profile kickoff failed:",
          err?.message
        );
      });
    } catch (kickErr) {
      console.error(
        "[ig-callback] auto-profile kickoff threw synchronously:",
        kickErr?.message
      );
    }

    // Cookie clearing includes the single-use switch acknowledgment,
    // whether or not this connect consumed it.
    return redirectClearingAuthCookies(successRedirect);
  } catch (err) {
    console.error("Instagram callback error:", err);
    getPostHogClient().capture({
      distinctId: "anonymous",
      event: "instagram_connection_failed",
      properties: { reason: "callback_error" },
    });
    return redirectClearingAuthCookies(
      `${baseUrl}/onboarding?step=1&error=callback_failed`
    );
  }
}

// Every callback exit — success, error, denial, or block — clears both
// flow cookies: oauth_state (the CSRF nonce) and ig_switch_ack (the
// single-use, target-bound switch acknowledgment). A stale ack surviving
// an aborted flow could otherwise linger for its 10-minute lifetime and
// grease a later swap the user never finished confirming.
function redirectClearingAuthCookies(url) {
  const response = NextResponse.redirect(url);
  response.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
  response.cookies.set("ig_switch_ack", "", { maxAge: 0, path: "/" });
  return response;
}

// POST subscribed_apps with the canonical field list. Logs non-OK responses
// but never throws — the caller verifies the outcome with a read-back.
async function subscribeWebhookFields(igbaId, accessToken) {
  const res = await fetch(
    `https://graph.instagram.com/v21.0/${igbaId}/subscribed_apps`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        subscribed_fields: REQUIRED_WEBHOOK_FIELDS.join(","),
        access_token: accessToken,
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    console.error(
      "[ig-callback] subscribed_apps POST failed:",
      res.status,
      data?.error?.message
    );
  }
}

// Reads back the fields Meta actually holds for this account and returns
// the missing ones ([] = fully subscribed). Returns null when the GET
// itself failed, so the caller can distinguish "unverifiable" from
// "verified incomplete".
async function fetchMissingWebhookFields(igbaId, accessToken) {
  try {
    const res = await fetch(
      `https://graph.instagram.com/v21.0/${igbaId}/subscribed_apps?access_token=${encodeURIComponent(accessToken)}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      console.error(
        "[ig-callback] subscribed_apps GET failed:",
        res.status,
        data?.error?.message
      );
      return null;
    }
    const subscribed = data?.data?.[0]?.subscribed_fields || [];
    return missingWebhookFields(subscribed);
  } catch (err) {
    console.error("[ig-callback] subscribed_apps GET threw:", err?.message);
    return null;
  }
}
