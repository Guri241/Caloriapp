import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/subscription-sync";

export const runtime = "nodejs";
// 署名検証には生のリクエストボディが必要なため、キャッシュや事前処理を挟ませない。
export const dynamic = "force-dynamic";

// 契約状態の変化を取りこぼさないために購読するイベント。
// checkout完了だけを見ていると、更新・解約・決済失敗が反映されない。
const HANDLED_EVENTS = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.payment_succeeded",
]);

async function resolveSubscription(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<Stripe.Subscription | null> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.subscription) return null;
      const id =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      return stripe.subscriptions.retrieve(id);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return event.data.object as Stripe.Subscription;
    case "invoice.payment_failed":
    case "invoice.payment_succeeded": {
      // 請求書イベントには最新のstatusが載らないので、subscriptionを取り直す。
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      if (!invoice.subscription) return null;
      const id =
        typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;
      return stripe.subscriptions.retrieve(id);
    }
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, getWebhookSecret());
  } catch (error) {
    // 署名検証の失敗は400を返す。Stripeはリトライしない（＝正しい挙動）。
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    const subscription = await resolveSubscription(stripe, event);
    if (subscription) {
      await syncSubscriptionFromStripe(subscription);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    // 5xxを返すとStripeがリトライしてくれる。upsertなので再実行しても安全。
    console.error("Stripe webhook handling failed", event.type, error);
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
