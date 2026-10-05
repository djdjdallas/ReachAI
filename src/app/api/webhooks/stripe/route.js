import { NextResponse, after } from "next/server";
import { getStripe, PLANS } from "@/lib/stripe";
import { formatPrice, formatTrialDate } from "@/lib/checkout-trial";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  pendingCancelFromSubscription,
  syncPendingCancel,
} from "@/lib/stripe-cancel";
import {
  decideSubscriptionUpdate,
  shouldActivateCheckout,
  trackedSubscriptionFilter,
  CLEAR_PENDING_CANCEL,
} from "@/lib/stripe-subscription-guard";
import { getPostHogClient } from "@/lib/posthog-server";
import { sendBusinessEventAlert } from "@/lib/alerts/business-events";
import { sendEmail } from "@/lib/notifications";
import {
  subscriptionIdFromInvoice,
  markPastDue,
  dunningEmailHtml,
} from "@/lib/stripe-invoice";
import {
  subscriptionFields,
  SERVING_STRIPE_STATUSES,
} from "@/lib/billing/subscription-sync";
import { recordTrialLedger } from "@/lib/billing/trial-policy";

// Map a Stripe price ID to the plan key ("base" or "unlimited"), or null
// for a price this app doesn't know (the plan column is then left alone).
function getPlanFromPriceId(priceId) {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) return key;
  }
  return null;
}

// ── Idempotency ─────────────────────────────────────────────────────────
// Stripe delivers at least once. Each event id is claimed in
// stripe_webhook_events (primary key, insert ... on conflict do nothing):
// a redelivery finds it claimed and is acknowledged without processing, so
// alerts and emails can't double-send. If processing fails, the claim is
// released so Stripe's retry processes it again.
//
// If the table can't be reached, the event is processed anyway (handlers
// are guarded against replays on their own); blocking billing on a missing
// dedupe row would be worse than a rare duplicate alert.
async function claimEvent(supabase, event) {
  const { data, error } = await supabase
    .from("stripe_webhook_events")
    .upsert(
      { event_id: event.id, event_type: event.type },
      { onConflict: "event_id", ignoreDuplicates: true }
    )
    .select("event_id");
  if (error) {
    console.error("[stripe-webhook] event claim unavailable, processing anyway:", error.message);
    return "unavailable";
  }
  return data?.length ? "claimed" : "duplicate";
}

async function releaseEvent(supabase, eventId) {
  const { error } = await supabase.from("stripe_webhook_events").delete().eq("event_id", eventId);
  if (error) console.error("[stripe-webhook] event release failed:", error.message);
}

// ── Subscription sync ───────────────────────────────────────────────────
// customer.subscription.created / .updated and both invoice events land
// here. Everything is read off the LIVE subscription (retrieved now), never
// the event payload, which is stale on a retried or out-of-order delivery.
// Writes subscription_status (as Stripe reports it), stripe_subscription_id,
// plan, current_period_end and trial_ends_at (subscriptionFields), plus the
// pending-cancel columns via syncPendingCancel.
async function syncSubscription(supabase, { subscriptionId, customerId: eventCustomerId, eventType }) {
  // A lookup failure throws, so the webhook 500s and Stripe retries.
  const retrieved = await getStripe().subscriptions.retrieve(subscriptionId);
  // Same object either way; the requested id is the fallback.
  const live = { ...retrieved, id: retrieved.id || subscriptionId };
  const customerId =
    (typeof live.customer === "string" ? live.customer : live.customer?.id) || eventCustomerId;

  // A read error throws (500, Stripe retries): treated as "no row" it
  // skipped the event with a 200 and the change was lost.
  const { data: currentUser, error: readError } = await supabase
    .from("users")
    .select("id, email, ai_mode, subscription_status, stripe_subscription_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (readError) throw readError;

  const decision = decideSubscriptionUpdate({
    row: currentUser,
    subscriptionId: live.id,
    liveStatus: live.status,
  });
  if (!decision.apply) {
    console.warn(
      `[stripe-webhook] ${eventType} skipped:`,
      decision.reason,
      "subscription:", live.id,
      "customer:", customerId
    );
    return { applied: false, live, user: currentUser };
  }

  const updateData = subscriptionFields(live, getPlanFromPriceId);

  // Reactivation: only flip ai_mode back to 'active' when the subscription
  // serves AND the account is currently hard-off (cancellation sets 'off').
  // An intentional 'handoff' is preserved.
  if (SERVING_STRIPE_STATUSES.has(live.status) && currentUser?.ai_mode === "off") {
    updateData.ai_mode = "active";
  }

  // Voice Replies + Drip: kill switches follow the plan. Any non-unlimited
  // plan (downgrade to base, etc.) disables both immediately. Upgrades back
  // to unlimited do NOT auto-re-enable; coach contacts support.
  if (updateData.plan && updateData.plan !== "unlimited") {
    updateData.voice_replies_enabled = false;
    updateData.drip_enabled = false;
  }

  // The subscription guard also sits in the UPDATE, so a checkout that
  // writes a new subscription id between the read above and this write
  // makes this event match no row instead of overwriting the new one.
  const { data: updatedRows, error: updateError } = await supabase
    .from("users")
    .update(updateData)
    .eq("stripe_customer_id", customerId)
    .or(trackedSubscriptionFilter(live.id))
    .select("id");
  if (updateError) throw updateError;
  if (!updatedRows?.length) {
    console.warn(
      `[stripe-webhook] ${eventType} matched no row tracking this subscription, skipped.`,
      "subscription:", live.id,
      "customer:", customerId
    );
    return { applied: false, live, user: currentUser };
  }

  // Pending cancellation: the portal schedules cancel_at for the period
  // end and status stays active until then. syncPendingCancel sets it with
  // a conditional update, so of two deliveries of the same cancel exactly
  // one is a NEW request, and a reactivation clears both columns.
  const pending = pendingCancelFromSubscription(live);
  const { newRequest, row: canceling } = await syncPendingCancel(supabase, customerId, pending);

  // Founder alert on a NEW cancel request: the save-the-customer window,
  // weeks before customer.subscription.deleted.
  if (newRequest) {
    after(() =>
      sendBusinessEventAlert("cancellation_requested", {
        email: canceling.email,
        instagramUsername: canceling.instagram_username,
        plan: canceling.plan,
        cancelAt: pending.cancelAt,
        canceledAt: pending.canceledAt,
        reason: live.cancellation_details?.feedback || null,
        comment: live.cancellation_details?.comment || null,
        stripeCustomerId: customerId,
      }).catch(console.error)
    );
    getPostHogClient().capture({
      distinctId: canceling.id || customerId,
      event: "subscription_cancel_requested",
      properties: { cancel_at: pending.cancelAt, plan: canceling.plan },
    });
  }

  // A downgrade disabled drip: cancel every scheduled nudge so nothing
  // fires mid-cycle.
  if (updateData.drip_enabled === false && currentUser?.id) {
    await supabase
      .from("dm_drip_queue")
      .update({
        status: "canceled",
        skip_reason: "user_drip_disabled_by_stripe",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", currentUser.id)
      .eq("status", "scheduled");
  }

  return { applied: true, live, user: currentUser };
}

export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    let event;
    try {
      event = getStripe().webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err.message);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Signature verified above, before anything else. Now dedupe.
    const claim = await claimEvent(supabase, event);
    if (claim === "duplicate") {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          // In-app checkout carries metadata.userId; a dashboard Payment Link
          // can't set per-session metadata, so those links pass the user id via
          // ?client_reference_id={userId} instead. Either source activates.
          const userId =
            session.metadata?.userId || session.client_reference_id || null;

          // Only a subscription that is serving right now activates the row
          // (shouldActivateCheckout): a replay after it ended, went unpaid or
          // past_due must not write 'active'. Live status from Stripe, not the
          // payload. A lookup failure throws, so the webhook 500s and Stripe
          // retries rather than activating blind.
          let liveSubscription = null;
          if (userId && session.subscription) {
            liveSubscription = await getStripe().subscriptions.retrieve(
              session.subscription
            );
          }
          if (userId && !shouldActivateCheckout(liveSubscription?.status ?? null)) {
            console.warn(
              "[stripe-webhook] checkout.session.completed for a subscription that is not active or trialing, skipped.",
              "session:", session.id,
              "subscription:", session.subscription,
              "status:", liveSubscription?.status
            );
            break;
          }

          if (userId) {
            // Mirror the sync path: if cancellation hard-flipped ai_mode to
            // 'off', restore on checkout completion. The status is the live
            // one, which the allowlist above already limited to
            // active/trialing. 'handoff' is intentionally preserved.
            const { data: currentUser, error: currentUserError } = await supabase
              .from("users")
              .select("ai_mode, email")
              .eq("id", userId)
              .maybeSingle();
            if (currentUserError) throw currentUserError;

            // Everything synced from the LIVE subscription: status as Stripe
            // reports it ('trialing' for a card-required trial), plan from its
            // price, current_period_end, trial_ends_at (a carried legacy trial
            // or the new 7-day one).
            const fields = subscriptionFields(liveSubscription, getPlanFromPriceId);
            const plan = fields.plan || "base";
            const updateData = {
              ...fields,
              plan,
              stripe_customer_id: session.customer,
              // A new subscription ends any earlier pending cancel.
              ...CLEAR_PENDING_CANCEL,
            };

            if (currentUser?.ai_mode === "off") {
              updateData.ai_mode = "active";
            }

            const { data: activatedRows, error: activateError } = await supabase
              .from("users")
              .update(updateData)
              .eq("id", userId)
              .select("id");
            if (activateError || !activatedRows?.length) {
              // The update no-ops on zero rows, but a checkout whose userId
              // matches no users row is a stranded paying customer: make it
              // findable in Vercel logs.
              console.error(
                "[stripe-webhook] checkout activation matched no users row.",
                "userId:", userId,
                "session:", session.id,
                "customer:", session.customer,
                "error:", activateError?.message || null
              );
            }

            // One trial per person: this email has now trialed/subscribed.
            await recordTrialLedger(supabase, {
              email: currentUser?.email,
              stripeCustomerId: session.customer,
              source: "stripe_checkout",
            });

            getPostHogClient().capture({
              distinctId: userId,
              event: "subscription_activated",
              properties: { plan },
            });

            // Founder alert: new paid subscriber. Deferred via after() — a
            // Resend outage stays invisible to webhook processing, and the
            // send survives the 200 going out (an un-awaited promise dies
            // when the function freezes after the response).
            after(() =>
              sendBusinessEventAlert("subscription_started", {
                email: currentUser?.email || null,
                plan,
                amountTotal:
                  typeof session.amount_total === "number"
                    ? session.amount_total
                    : null,
                stripeCustomerId: session.customer,
              }).catch(console.error)
            );

            // Enroll new subscriber in drip campaign. Same after() treatment:
            // a frozen invocation must not silently skip enrollment.
            after(() =>
              fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/drip/enroll`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-internal-secret": process.env.CRON_SECRET || "",
                },
                body: JSON.stringify({ userId }),
              }).catch((err) =>
                console.error("Drip enrollment failed:", err.message)
              )
            );
          } else {
            // Neither metadata.userId nor client_reference_id — this checkout
            // cannot be linked to a users row, so NOTHING activates and every
            // future event for this Stripe customer will match zero rows. Log
            // loudly (session + customer ids make it recoverable by hand) but
            // still return 200 so Stripe doesn't retry-storm.
            console.error(
              "[stripe-webhook] checkout.session.completed with NO user identifier — activation skipped.",
              "session:", session.id,
              "customer:", session.customer
            );
          }
          break;
        }

        case "invoice.payment_succeeded": {
          // Trial-to-paid conversion and every renewal. Re-sync from the live
          // subscription: status, and the new current_period_end. (This used
          // to hard-code 'active', which would mark a $0 trial invoice's
          // subscription active while Stripe says trialing.) Only
          // subscription invoices; the sync's guards stop a late retry from
          // reviving a canceled row.
          const invoice = event.data.object;
          const subscriptionId = subscriptionIdFromInvoice(invoice);
          if (invoice.customer && subscriptionId) {
            await syncSubscription(supabase, {
            subscriptionId,
            customerId: invoice.customer,
            eventType: event.type,
          });
          }
          break;
        }

        case "customer.subscription.created": {
          // Usually lands with checkout.session.completed; either may arrive
          // first. The sync is idempotent and guarded, so both are safe.
          const subscription = event.data.object;
          const { applied, user } = await syncSubscription(supabase, {
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            eventType: event.type,
          });
          if (applied && user?.email) {
            await recordTrialLedger(supabase, {
              email: user.email,
              stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
              source: "stripe_subscription",
            });
          }
          break;
        }

        case "customer.subscription.trial_will_end": {
          // Fires ~3 days before trial ends. Surface a dunning ping so the
          // account owner knows billing is about to begin.
          const subscription = event.data.object;
          const customerId = subscription.customer;
          const { data: owner } = await supabase
            .from("users")
            .select("id, email, full_name")
            .eq("stripe_customer_id", customerId)
            .single();

          if (owner?.email) {
            // Live again since checkout carries the remaining trial
            // (src/lib/checkout-trial.js). Names the real date and amount: the
            // trial is whatever was left of the signup trial, not "7-day".
            const price = subscription.items?.data?.[0]?.price?.unit_amount;
            const endDate = subscription.trial_end
              ? formatTrialDate(subscription.trial_end)
              : null;
            const chargeLine =
              endDate && typeof price === "number"
                ? `Your Clinchd trial ends on ${endDate}, and your card will be charged ${formatPrice(price)} then.`
                : "Your Clinchd trial ends in a few days, and your card will be charged for the plan you selected.";
            try {
              const { sendEmail } = await import("@/lib/notifications");
              await sendEmail({
                to: owner.email,
                subject: "Your Clinchd trial ends soon",
                html: `<p>Hi ${owner.full_name || "there"},</p>
                  <p>Just a heads-up: ${chargeLine} If you'd like to cancel or change plans, open the billing page in your dashboard. No pressure.</p>
                  <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/billing">Manage billing →</a></p>
                  <p>Clinchd</p>`,
              });
            } catch (err) {
              console.error("trial_will_end email failed:", err?.message);
            }
          }
          break;
        }

        case "customer.subscription.updated": {
          // Plan switches, cancel requests, reactivations, trial ending,
          // status changes. All via the live subscription.
          const subscription = event.data.object;
          await syncSubscription(supabase, {
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            eventType: event.type,
          });
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const customerId = subscription.customer;

          // Read before the write: the alert wants the plan as it was. A read
          // error throws (500, Stripe retries) rather than reading as no row.
          const { data: canceledUser, error: readError } = await supabase
            .from("users")
            .select("id, email, plan, created_at")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          if (readError) throw readError;

          // The subscription guard lives in the UPDATE itself, not in a prior
          // read: a late delete of a subscription this row no longer tracks
          // (the customer resubscribed since) matches no row, even if it races
          // the checkout that wrote the new subscription id.
          const { data: canceledRows, error: cancelError } = await supabase
            .from("users")
            .update({
              subscription_status: "canceled",
              // The cancel is no longer pending; it happened.
              ...CLEAR_PENDING_CANCEL,
              // Reset the plan tier too: gates that key on plan alone (e.g.
              // comment-to-DM) otherwise keep running for canceled Unlimited
              // users forever — classifier spend + DM dispatch, free.
              plan: "base",
              ai_mode: "off",
              voice_replies_enabled: false,
              drip_enabled: false,
            })
            .eq("stripe_customer_id", customerId)
            .or(trackedSubscriptionFilter(subscription.id))
            .select("id");
          if (cancelError) throw cancelError;
          if (!canceledRows?.length) {
            console.warn(
              "[stripe-webhook] customer.subscription.deleted matched no row tracking this subscription, skipped.",
              "subscription:", subscription.id,
              "customer:", customerId
            );
            break;
          }

          // Cancel any scheduled follow-up nudges so none fire after cancellation.
          if (canceledUser?.id) {
            await supabase
              .from("dm_drip_queue")
              .update({
                status: "canceled",
                skip_reason: "user_drip_disabled_by_stripe",
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", canceledUser.id)
              .eq("status", "scheduled");
          }

          if (canceledUser) {
            getPostHogClient().capture({
              distinctId: canceledUser.id,
              event: "subscription_canceled",
            });

            // Founder alert with lifetime conversation count so severity is
            // instantly readable (a 0-conversation trial lapse vs a
            // 270-conversation churn are different emergencies). Count failure
            // degrades to "unknown" — it never blocks the alert or the webhook.
            let conversationCount = "unknown";
            try {
              const { count, error: countError } = await supabase
                .from("conversations")
                .select("id", { count: "exact", head: true })
                .eq("user_id", canceledUser.id);
              if (!countError && typeof count === "number") {
                conversationCount = count;
              }
            } catch (err) {
              console.error(
                "cancellation conversation count failed:",
                err?.message
              );
            }
            after(() =>
              sendBusinessEventAlert("subscription_canceled", {
                email: canceledUser.email,
                plan: canceledUser.plan,
                conversationCount,
                signupDate: canceledUser.created_at,
                stripeCustomerId: customerId,
              }).catch(console.error)
            );
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const customerId = invoice.customer;

          // Same guard as payment_succeeded: only a failed SUBSCRIPTION invoice
          // means the plan is at risk. A failed one-off invoice must not flip
          // the account to past_due or send the dunning email.
          if (!customerId || !subscriptionIdFromInvoice(invoice)) break;

          // Never resurrects a canceled row (markPastDue). The dunning email
          // goes only to a row that was actually flipped, so a late failure
          // for an already-canceled customer sends nothing.
          const pastDueUser = await markPastDue(supabase, customerId);

          // Dunning: past_due used to be silent — the coach found out from
          // lost leads. AI replies keep running through the grace window (the
          // DM gate allows past_due), but the coach needs to fix the card
          // before Stripe gives up and cancels.
          if (pastDueUser?.email) {
            const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/billing`;
            after(() =>
              sendEmail({
                to: pastDueUser.email,
                subject: "Your Clinchd payment didn't go through",
                html: dunningEmailHtml({
                  fullName: pastDueUser.full_name,
                  billingUrl,
                }),
              }).catch((err) =>
                console.error("[stripe-webhook] dunning email failed:", err?.message)
              )
            );
          }

          // Align everything else with Stripe (status as Stripe reports it).
          await syncSubscription(supabase, {
            subscriptionId: subscriptionIdFromInvoice(invoice),
            customerId,
            eventType: event.type,
          });
          break;
        }

        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (handlerError) {
      // Let Stripe's retry process this event again.
      if (claim === "claimed") await releaseEvent(supabase, event.id);
      throw handlerError;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
