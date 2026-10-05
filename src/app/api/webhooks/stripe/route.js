import { NextResponse, after } from "next/server";
import { getStripe, PLANS } from "@/lib/stripe";
import { formatPrice, formatTrialDate } from "@/lib/checkout-trial";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  pendingCancelFromSubscription,
  syncPendingCancel,
} from "@/lib/stripe-cancel";
import {
  mapSubscriptionStatus,
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

// Map a Stripe price ID to the plan key ("base" or "unlimited")
function getPlanFromPriceId(priceId) {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) return key;
  }
  return "base";
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
          // Fix 6: Retrieve line items to determine which plan was purchased
          let plan = "base";
          try {
            const lineItems = await getStripe().checkout.sessions.listLineItems(
              session.id,
              { limit: 1 }
            );
            if (lineItems.data.length > 0) {
              plan = getPlanFromPriceId(lineItems.data[0].price.id);
            }
          } catch (err) {
            console.error("Failed to retrieve checkout line items:", err.message);
          }

          // Mirror the .updated handler: if trial expiry hard-flipped
          // ai_mode to 'off', restore on checkout completion. The status is
          // the live one, which the allowlist above already limited to
          // active/trialing, so no extra status guard is needed. 'handoff'
          // is intentionally preserved.
          const { data: currentUser } = await supabase
            .from("users")
            .select("ai_mode, email")
            .eq("id", userId)
            .maybeSingle();

          const updateData = {
            subscription_status: mapSubscriptionStatus(liveSubscription.status),
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            plan,
            // A new subscription ends any earlier pending cancel.
            ...CLEAR_PENDING_CANCEL,
          };

          if (currentUser?.ai_mode === "off") {
            updateData.ai_mode = "active";
          }

          // Align trial_ends_at with what Stripe actually did, so the row
          // stops showing the stale signup date. Checkout carries the
          // remaining in-app trial (src/lib/checkout-trial.js): if the new
          // subscription has a trial, trial_ends_at becomes its trial_end
          // (same instant, rounded down). If the user was charged today,
          // the trial is over and trial_ends_at is cleared. On a lookup
          // failure the column is left as-is rather than guessed.
          if (session.subscription) {
            try {
              const sub = await getStripe().subscriptions.retrieve(
                session.subscription
              );
              updateData.trial_ends_at = sub.trial_end
                ? new Date(sub.trial_end * 1000).toISOString()
                : null;
            } catch (err) {
              console.error(
                "[stripe-webhook] trial_ends_at alignment skipped:",
                err?.message
              );
            }
          }

          const { data: activatedRows, error: activateError } = await supabase
            .from("users")
            .update(updateData)
            .eq("id", userId)
            .select("id");
          if (activateError || !activatedRows?.length) {
            // The update no-ops on zero rows, but a checkout whose userId
            // matches no users row is a stranded paying customer — make it
            // findable in Vercel logs.
            console.error(
              "[stripe-webhook] checkout activation matched no users row.",
              "userId:", userId,
              "session:", session.id,
              "customer:", session.customer,
              "error:", activateError?.message || null
            );
          }

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
        // Runs on trial → paid conversion and every subsequent renewal.
        // Make sure the user is `active` (Stripe may fire this before the
        // customer.subscription.updated event in trial-end flows).
        //
        // Guards: only subscription invoices, and never resurrect a canceled
        // user — Stripe delivery is at-least-once and unordered, so a
        // late-retried payment_succeeded (e.g. the final invoice) can arrive
        // AFTER customer.subscription.deleted; without the .neq it flipped
        // that user back to active permanently.
        const invoice = event.data.object;
        const customerId = invoice.customer;
        // subscriptionIdFromInvoice: on this endpoint's API version the ID is
        // at parent.subscription_details.subscription, not invoice.subscription
        // (which made this handler a permanent no-op).
        if (customerId && subscriptionIdFromInvoice(invoice)) {
          await supabase
            .from("users")
            .update({ subscription_status: "active" })
            .eq("stripe_customer_id", customerId)
            .neq("subscription_status", "canceled");
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
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Decide on the LIVE subscription, not this payload: a retried or
        // out-of-order delivery carries stale status and cancel fields
        // (src/lib/stripe-subscription-guard.js). A lookup failure throws,
        // so the webhook 500s and Stripe retries.
        const live = await getStripe().subscriptions.retrieve(subscription.id);
        const subscriptionStatus = mapSubscriptionStatus(live.status);

        // Fix 6: Also sync plan on subscription changes (portal upgrades/downgrades)
        let plan;
        if (live.items?.data?.length > 0) {
          plan = getPlanFromPriceId(live.items.data[0].price.id);
        }

        // Fetch current ai_mode so we can decide whether to restore it on
        // reactivation. Trial expiry (webhook AI path + /api/ai/reply C1
        // gate) hard-flips ai_mode='off'; without restoration here a
        // coach who pays after expiry comes back as a silent account.
        // Also reads what decideSubscriptionUpdate needs. A read error throws
        // (500, Stripe retries): treated as "no row" it skipped the event
        // with a 200 and the change was lost.
        const { data: currentUser, error: readError } = await supabase
          .from("users")
          .select("ai_mode, subscription_status, stripe_subscription_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (readError) throw readError;

        const decision = decideSubscriptionUpdate({
          row: currentUser,
          subscriptionId: subscription.id,
          liveStatus: live.status,
        });
        if (!decision.apply) {
          console.warn(
            "[stripe-webhook] customer.subscription.updated skipped:",
            decision.reason,
            "subscription:", subscription.id,
            "customer:", customerId
          );
          break;
        }

        const updateData = { subscription_status: subscriptionStatus };
        if (plan) {
          updateData.plan = plan;
        }

        // Reactivation: only flip ai_mode back to 'active' when the
        // subscription is becoming active AND the account is currently
        // hard-off. The '=== off' guard preserves an intentional
        // 'handoff' choice (e.g. Meta App Review window).
        if (
          subscriptionStatus === "active" &&
          currentUser?.ai_mode === "off"
        ) {
          updateData.ai_mode = "active";
        }

        // Voice Replies + Drip: kill switches follow the plan. Any
        // non-unlimited plan (downgrade to base, etc.) disables both
        // immediately so a downgraded coach can't keep firing existing
        // snippets or queued nudges. Upgrades back to unlimited do NOT
        // auto-re-enable — coach contacts support.
        if (plan && plan !== "unlimited") {
          updateData.voice_replies_enabled = false;
          updateData.drip_enabled = false;
        }

        // decideSubscriptionUpdate read the row; the same subscription guard
        // also sits in the UPDATE, so a checkout that writes a new
        // subscription id between that read and this write makes this event
        // match no row instead of overwriting the new subscription.
        const { data: updatedRows, error: updateError } = await supabase
          .from("users")
          .update(updateData)
          .eq("stripe_customer_id", customerId)
          .or(trackedSubscriptionFilter(subscription.id))
          .select("id");
        if (updateError) throw updateError;
        if (!updatedRows?.length) {
          console.warn(
            "[stripe-webhook] customer.subscription.updated matched no row tracking this subscription, skipped.",
            "subscription:", subscription.id,
            "customer:", customerId
          );
          break;
        }

        // Pending cancellation: the portal schedules cancel_at for the
        // period end and status stays 'active' until then. syncPendingCancel
        // sets it with a conditional update, so of two deliveries of the
        // same cancel exactly one is a NEW request, and a reactivation
        // clears both columns. Read off the live subscription, so a cancel
        // event delivered after a reactivation sets nothing.
        const pending = pendingCancelFromSubscription(live);
        const { newRequest, row: canceling } = await syncPendingCancel(
          supabase,
          customerId,
          pending
        );

        // Founder alert on a NEW cancel request: the save-the-customer
        // window, weeks before customer.subscription.deleted.
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

        // When drip is being disabled by a downgrade, cancel every scheduled
        // nudge for that coach so nothing fires mid-cycle after they downgrade.
        if (updateData.drip_enabled === false) {
          const { data: downgraded } = await supabase
            .from("users")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          if (downgraded?.id) {
            await supabase
              .from("dm_drip_queue")
              .update({
                status: "canceled",
                skip_reason: "user_drip_disabled_by_stripe",
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", downgraded.id)
              .eq("status", "scheduled");
          }
        }
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
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
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
