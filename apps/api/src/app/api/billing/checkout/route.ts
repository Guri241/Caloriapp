import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";
import { PRICES, resolveStripePriceId } from "@/lib/plans";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { ensureStripeCustomerId } from "@/lib/subscription-sync";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  interval: z.enum(["MONTH", "YEAR"]).default("YEAR"),
});

// Stripe Checkoutのセッションを作り、決済ページのURLを返す。
// Web経由で課金することでApp Store/Google Playの手数料(15-30%)を回避する。
export async function POST(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const { interval } = checkoutSchema.parse(await request.json().catch(() => ({})));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing?.status === "ACTIVE" || existing?.status === "TRIALING") {
      throw new ApiError(409, "Subscription is already active", {
        code: "already_subscribed",
      });
    }

    const stripe = getStripe();
    const customerId = await ensureStripeCustomerId(stripe, userId, user.email);
    const appUrl = getAppUrl();
    const price = PRICES[interval];

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: resolveStripePriceId(interval), quantity: 1 }],
      // 解約導線をStripe側に寄せると、こちらで解約フローを実装せずに済む。
      subscription_data: {
        metadata: { userId },
        ...(price.trialDays > 0 ? { trial_period_days: price.trialDays } : {}),
      },
      // 決済完了をアプリ側で即座に反映させるため、session_idを戻り先に載せる。
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?canceled=1`,
      allow_promotion_codes: true,
      client_reference_id: userId,
    });

    if (!session.url) {
      throw new ApiError(502, "Stripe did not return a checkout URL");
    }

    return jsonOk({ url: session.url, interval, amountJpy: price.amountJpy });
  } catch (error) {
    return handleApiError(error);
  }
}
