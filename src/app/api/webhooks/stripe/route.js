import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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
          await supabase
            .from("users")
            .update({
              subscription_status: "active",
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
            })
            .eq("id", userId);
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

        await supabase
          .from("users")
          .update({ subscription_status: subscriptionStatus })
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await supabase
          .from("users")
          .update({
            subscription_status: "canceled",
            ai_active: false,
          })
          .eq("stripe_customer_id", customerId);
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
