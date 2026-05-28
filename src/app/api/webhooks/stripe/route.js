import { NextResponse } from "next/server";
import { getStripe, PLANS } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPostHogClient } from "@/lib/posthog-server";

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
        const userId = session.metadata?.userId;

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

          await supabase
            .from("users")
            .update({
              subscription_status: "active",
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              plan,
            })
            .eq("id", userId);

          getPostHogClient().capture({
            distinctId: userId,
            event: "subscription_activated",
            properties: { plan },
          });

          // Enroll new subscriber in drip campaign
          fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/drip/enroll`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": process.env.CRON_SECRET || "",
            },
            body: JSON.stringify({ userId }),
          }).catch((err) =>
            console.error("Drip enrollment failed:", err.message)
          );
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // Runs on trial → paid conversion and every subsequent renewal.
        // Make sure the user is `active` (Stripe may fire this before the
        // customer.subscription.updated event in trial-end flows).
        const invoice = event.data.object;
        const customerId = invoice.customer;
        if (customerId) {
          await supabase
            .from("users")
            .update({ subscription_status: "active" })
            .eq("stripe_customer_id", customerId);
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

        const updateData = { subscription_status: subscriptionStatus };
        if (plan) {
          updateData.plan = plan;
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
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        await supabase
          .from("users")
          .update({
            subscription_status: "canceled",
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
