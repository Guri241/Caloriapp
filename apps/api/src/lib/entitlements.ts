import type { MeteredFeature, PlanTier, Subscription } from "@prisma/client";
import { ApiError } from "./api-response";
import { PLANS, type PlanLimits } from "./plans";
import { prisma } from "./prisma";

// 決済失敗（PAST_DUE）でも即座に機能を止めず、この日数だけ猶予する。
// 期限切れカードによる非自発的解約は、待てば回収できる割合が高いため。
const PAST_DUE_GRACE_DAYS = 3;

// クライアントがペイウォール表示に使うエラーコード。
export const PAYWALL_CODES = {
  PLAN_REQUIRED: "plan_required", // 有料プラン専用機能に無料ユーザーが触れた
  QUOTA_EXCEEDED: "quota_exceeded", // 月次上限に到達した
} as const;

export interface Entitlement {
  tier: PlanTier;
  isPro: boolean;
  limits: PlanLimits;
  status: Subscription["status"] | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | null;
}

function monthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Stripe上のstatusと期末日から、いま実際にPro機能を使わせてよいかを判定する。
// Stripeを正とし、Webhookが遅延した場合でも期末日で保護されるようにしている。
function isProActive(subscription: Subscription | null, now: Date): boolean {
  if (!subscription || subscription.tier !== "PRO") return false;

  switch (subscription.status) {
    case "TRIALING":
    case "ACTIVE":
      return true;
    case "PAST_DUE":
      // 決済リトライ中。期末＋猶予期間までは使わせる。
      return subscription.currentPeriodEnd
        ? now <= addDays(subscription.currentPeriodEnd, PAST_DUE_GRACE_DAYS)
        : false;
    case "CANCELED":
      // 期末解約を予約済み。支払い済みの期間内はProのまま。
      return subscription.currentPeriodEnd ? now <= subscription.currentPeriodEnd : false;
    case "INCOMPLETE":
      return false;
  }
}

export async function getEntitlement(userId: string, now = new Date()): Promise<Entitlement> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const isPro = isProActive(subscription, now);
  const tier: PlanTier = isPro ? "PRO" : "FREE";

  return {
    tier,
    isPro,
    limits: PLANS[tier].limits,
    status: subscription?.status ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    trialEndsAt: subscription?.trialEndsAt ?? null,
  };
}

// Pro専用の真偽値フィーチャー（レポート・エクスポート・ヘルス連携）を要求する。
export async function requireProFeature(
  userId: string,
  feature: "weeklyReport" | "csvExport" | "healthSync",
): Promise<Entitlement> {
  const entitlement = await getEntitlement(userId);
  if (!entitlement.limits[feature]) {
    throw new ApiError(402, "This feature requires the Pro plan", {
      code: PAYWALL_CODES.PLAN_REQUIRED,
      details: { feature, requiredTier: "PRO" },
    });
  }
  return entitlement;
}

const FEATURE_LIMIT_KEYS: Record<MeteredFeature, keyof PlanLimits> = {
  AI_PHOTO_ANALYSIS: "aiPhotoAnalysesPerMonth",
  FOOD_SEARCH: "foodSearchesPerMonth",
};

export interface QuotaState {
  feature: MeteredFeature;
  used: number;
  limit: number | null; // null = 無制限
  remaining: number | null;
}

export async function getQuotaState(
  userId: string,
  feature: MeteredFeature,
  entitlement?: Entitlement,
): Promise<QuotaState> {
  const ent = entitlement ?? (await getEntitlement(userId));
  const limit = ent.limits[FEATURE_LIMIT_KEYS[feature]] as number | null;
  const counter = await prisma.usageCounter.findUnique({
    where: {
      userId_feature_periodStart: { userId, feature, periodStart: monthStartUtc() },
    },
  });
  const used = counter?.count ?? 0;
  return {
    feature,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
  };
}

// 従量機能を1回分消費する。上限に達していれば402を投げる。
// 「先に加算して、超過していたら戻す」ことで、同時リクエストでも上限を超えない。
export async function consumeQuota(
  userId: string,
  feature: MeteredFeature,
  entitlement?: Entitlement,
): Promise<QuotaState> {
  const ent = entitlement ?? (await getEntitlement(userId));
  const limit = ent.limits[FEATURE_LIMIT_KEYS[feature]] as number | null;
  const periodStart = monthStartUtc();

  if (limit === null) {
    // 無制限プランでも原価監視のために使用量は記録する。
    const counter = await prisma.usageCounter.upsert({
      where: { userId_feature_periodStart: { userId, feature, periodStart } },
      create: { userId, feature, periodStart, count: 1 },
      update: { count: { increment: 1 } },
    });
    return { feature, used: counter.count, limit: null, remaining: null };
  }

  const counter = await prisma.usageCounter.upsert({
    where: { userId_feature_periodStart: { userId, feature, periodStart } },
    create: { userId, feature, periodStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (counter.count > limit) {
    await prisma.usageCounter.update({
      where: { id: counter.id },
      data: { count: { decrement: 1 } },
    });
    throw new ApiError(402, "Monthly limit reached for this feature", {
      code: PAYWALL_CODES.QUOTA_EXCEEDED,
      details: {
        feature,
        limit,
        used: limit,
        tier: ent.tier,
        upgradeTo: ent.isPro ? null : "PRO",
      },
    });
  }

  return { feature, used: counter.count, limit, remaining: limit - counter.count };
}

// 消費した枠を1回分戻す。外部API呼び出しが失敗したときに使う。
// 失敗した解析で無料枠を消費させると、課金前に信用を失うため。
export async function refundQuota(userId: string, feature: MeteredFeature): Promise<void> {
  await prisma.usageCounter.updateMany({
    where: { userId, feature, periodStart: monthStartUtc(), count: { gt: 0 } },
    data: { count: { decrement: 1 } },
  });
}

// 履歴の閲覧可能範囲。無料プランは直近N日だけ見せ、
// 「記録は貯まっているのに見られない」状態を課金理由にする。
export function historyCutoff(entitlement: Entitlement, now = new Date()): Date | null {
  const days = entitlement.limits.historyDays;
  if (days === null) return null;
  return addDays(now, -days);
}
