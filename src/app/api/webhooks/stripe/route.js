import { NextResponse, after } from "next/server";
import { getStripe, PLANS } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPostHogClient } from "@/lib/posthog-server";
import { sendBusinessEventAlert } from "@/lib/alerts/business-events";
import { sendEmail } from "@/lib/notifications";

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
          // ai_mode to 'off', restore on checkout completion. We always
          // resolve to subscription_status='active' here so no extra
          // status guard is needed. 'handoff' is intentionally preserved.
          const { data: currentUser } = await supabase
            .from("users")
            .select("ai_mode, email")
            .eq("id", userId)
            .maybeSingle();

          const updateData = {
            subscription_status: "active",
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            plan,
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
        if (customerId && invoice.subscription) {
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
          try {
            const { sendEmail } = await import("@/lib/notifications");
            await sendEmail({
              to: owner.email,
              subject: "Your Clinchd trial ends soon",
              html: `<p>Hi ${owner.full_name || "there"},</p>
                <p>Just a heads-up: your 7-day Clinchd trial ends in a few days, and your card will be charged for the plan you selected. If you'd like to cancel or change plans, open the billing page in your dashboard — no pressure.</p>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/billing">Manage billing →</a></p>
                <p>— Clinchd</p>`,
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

        // Map Stripe subscription status to our status
        let subscriptionStatus;
        switch (subscription.status) {
          case "active":
          case "trialing":
            subscriptionStatus = "active";
            break;
          case "past_due":
            subscriptionStatus = "past_due";
            break;
          case "canceled":
          case "unpaid":
            subscriptionStatus = "canceled";
            break;
          default:
            subscriptionStatus = subscription.status;
        }

        // Fix 6: Also sync plan on subscription changes (portal upgrades/downgrades)
        let plan;
        if (subscription.items?.data?.length > 0) {
          plan = getPlanFromPriceId(subscription.items.data[0].price.id);
        }

        // Fetch current ai_mode so we can decide whether to restore it on
        // reactivation. Trial expiry (webhook AI path + /api/ai/reply C1
        // gate) hard-flips ai_mode='off'; without restoration here a
        // coach who pays after expiry comes back as a silent account.
        const { data: currentUser } = await supabase
          .from("users")
          .select("ai_mode")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

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

        await supabase
          .from("users")
          .update(updateData)
          .eq("stripe_customer_id", customerId);

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

        const { data: canceledUser } = await supabase
          .from("users")
          .select("id, email, plan, created_at")
          .eq("stripe_customer_id", customerId)
          .single();

        await supabase
          .from("users")
          .update({
            subscription_status: "canceled",
            // Reset the plan tier too: gates that key on plan alone (e.g.
            // comment-to-DM) otherwise keep running for canceled Unlimited
            // users forever — classifier spend + DM dispatch, free.
            plan: "base",
            ai_mode: "off",
            voice_replies_enabled: false,
            drip_enabled: false,
          })
          .eq("stripe_customer_id", customerId);

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

        await supabase
          .from("users")
          .update({ subscription_status: "past_due" })
          .eq("stripe_customer_id", customerId);

        // Dunning: past_due used to be silent — the coach found out from
        // lost leads. AI replies keep running through the grace window (the
        // DM gate allows past_due), but the coach needs to fix the card
        // before Stripe gives up and cancels.
        const { data: pastDueUser } = await supabase
          .from("users")
          .select("email, full_name")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (pastDueUser?.email) {
          const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/billing`;
          after(() =>
            sendEmail({
              to: pastDueUser.email,
              subject: "Your Clinchd payment didn't go through",
            html: `<p>Hi${pastDueUser.full_name ? ` ${pastDueUser.full_name}` : ""},</p>
<p>Your latest Clinchd payment failed — usually an expired or declined card. Your AI agent is still replying to leads for now, and Stripe will retry the charge automatically over the next few days.</p>
<p>To avoid any interruption, update your payment method here: <a href="${billingUrl}">${billingUrl}</a></p>
<p>— Clinchd</p>`,
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
