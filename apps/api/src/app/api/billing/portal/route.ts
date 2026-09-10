import { requireAuth } from "@/lib/auth";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-response";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// 支払い方法の変更・解約・請求書のダウンロードはStripeのCustomer Portalに任せる。
// 自前で解約フローを持たないことで、実装コストと決済まわりの不具合リスクを減らす。
export async function POST(request: Request) {
  try {
    const { userId } = requireAuth(request);

    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription?.stripeCustomerId) {
      throw new ApiError(404, "No billing account found for this user", {
        code: "no_billing_account",
      });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${getAppUrl()}/account`,
    });

    return jsonOk({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}
