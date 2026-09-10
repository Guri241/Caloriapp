import type { BillingInterval, SubscriptionStatus } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "./prisma";

// StripeのsubscriptionオブジェクトをDBへ射影する。
// DBは表示・判定用のキャッシュにすぎず、常にStripeを正とする。

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "CANCELED";
    case "incomplete":
      return "INCOMPLETE";
    default:
      // Stripeが将来追加するstatusは、機能を渡さない側に倒す。
      return "INCOMPLETE";
  }
}

function mapInterval(interval: string | undefined): BillingInterval | null {
  if (interval === "year") return "YEAR";
  if (interval === "month") return "MONTH";
  return null;
}

// 期末日はsubscription本体ではなくitem側にある（Stripeの現行APIバージョン）。
// 複数itemがある場合は最も遅い期末をアクセス期限として採用する。
function resolvePeriodEnd(subscription: Stripe.Subscription): Date | null {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((v): v is number => typeof v === "number");
  if (ends.length === 0) return null;
  return new Date(Math.max(...ends) * 1000);
}

export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription,
): Promise<void> {
  // userIdはCheckout作成時にsubscription_dataのmetadataへ埋めている。
  // Stripe側のcustomer.metadataにも入れてあるので、片方が欠けても復元できる。
  const userId =
    subscription.metadata?.userId ??
    (typeof subscription.customer === "object" && !("deleted" in subscription.customer)
      ? subscription.customer.metadata?.userId
      : undefined);

  if (!userId) {
    console.error("Stripe subscription without userId metadata", subscription.id);
    return;
  }

  const status = mapStatus(subscription.status);
  const item = subscription.items.data[0];
  const price = item?.price;

  const data = {
    // 有効な契約でなくなったらtierをFREEに戻す。
    // 期末までのアクセスはcurrentPeriodEndで別途保護される。
    tier: status === "CANCELED" || status === "INCOMPLETE" ? ("FREE" as const) : ("PRO" as const),
    status,
    interval: mapInterval(price?.recurring?.interval),
    stripeCustomerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    stripePriceId: price?.id ?? null,
    currentPeriodEnd: resolvePeriodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
  };

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

// CheckoutでもPortalでも、同じStripe Customerを使い回す。
// 顧客が重複すると課金履歴と請求書が分断されるため。
export async function ensureStripeCustomerId(
  stripe: Stripe,
  userId: string,
  email: string,
): Promise<string> {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customer.id },
    update: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
