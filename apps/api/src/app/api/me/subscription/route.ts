import { requireAuth } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api-response";
import { getEntitlement, getQuotaState } from "@/lib/entitlements";
import { PLANS, PRICES, PRO_FEATURE_HIGHLIGHTS } from "@/lib/plans";

export const runtime = "nodejs";

// 課金状態・残枠・価格を1リクエストで返す。
// アプリ側が価格や上限を持たないので、値上げやプラン変更をサーバー側だけで反映できる。
export async function GET(request: Request) {
  try {
    const { userId } = requireAuth(request);
    const entitlement = await getEntitlement(userId);

    const [photoQuota, searchQuota] = await Promise.all([
      getQuotaState(userId, "AI_PHOTO_ANALYSIS", entitlement),
      getQuotaState(userId, "FOOD_SEARCH", entitlement),
    ]);

    return jsonOk({
      tier: entitlement.tier,
      isPro: entitlement.isPro,
      status: entitlement.status,
      currentPeriodEnd: entitlement.currentPeriodEnd,
      cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
      trialEndsAt: entitlement.trialEndsAt,
      limits: entitlement.limits,
      usage: { aiPhotoAnalysis: photoQuota, foodSearch: searchQuota },
      pricing: {
        year: PRICES.YEAR,
        month: PRICES.MONTH,
        proHighlights: PRO_FEATURE_HIGHLIGHTS,
        freeLimits: PLANS.FREE.limits,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
