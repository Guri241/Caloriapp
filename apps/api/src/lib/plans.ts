import type { BillingInterval, PlanTier } from "@prisma/client";

// ------------------------------------------
// プランカタログ
// LP・料金ページ・Stripe Checkout・エンタイトルメント判定が
// すべてこの1ファイルを参照する（価格表示と実際の課金がズレないようにするため）。
// ------------------------------------------

// 従量機能の月次上限。null = 無制限。
export interface PlanLimits {
  aiPhotoAnalysesPerMonth: number | null; // AI写真解析（唯一、原価が乗る機能）
  foodSearchesPerMonth: number | null; // USDA食品検索
  customFoods: number | null; // 自前登録できる食品マスタ数
  historyDays: number | null; // グラフ・履歴を遡れる日数
  weeklyReport: boolean; // 週次/月次レポート
  csvExport: boolean; // データエクスポート
  healthSync: boolean; // HealthKit / Google Fit 同期
}

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  limits: PlanLimits;
}

// 無料枠は「毎日使えるが、続けるなら物足りない」水準に置く。
// 上限を厳しくしすぎると習慣化前に離脱し、緩すぎると課金理由が消える。
export const FREE_PLAN: PlanDefinition = {
  tier: "FREE",
  name: "Free",
  limits: {
    aiPhotoAnalysesPerMonth: 5,
    foodSearchesPerMonth: 50,
    customFoods: 10,
    historyDays: 30,
    weeklyReport: false,
    csvExport: false,
    healthSync: false,
  },
};

// 有料枠のAI解析上限は「無制限」と書かずに公正利用上限を置く。
// 1解析ごとに実費がかかるため、上限がないと1人のヘビーユーザーで粗利が消える。
// 150回/月は1日5回（3食＋間食2回）に相当し、実用上ほぼ制約にならない一方で
// 最悪ケースの原価を計算可能な範囲に閉じ込められる（試算はMONETIZATION.md）。
export const PRO_PLAN: PlanDefinition = {
  tier: "PRO",
  name: "Pro",
  limits: {
    aiPhotoAnalysesPerMonth: 150,
    foodSearchesPerMonth: null,
    customFoods: null,
    historyDays: null,
    weeklyReport: true,
    csvExport: true,
    healthSync: true,
  },
};

export const PLANS: Record<PlanTier, PlanDefinition> = {
  FREE: FREE_PLAN,
  PRO: PRO_PLAN,
};

// ------------------------------------------
// 価格
// ------------------------------------------

export interface PriceOption {
  interval: BillingInterval;
  // 表示価格（円・税込）
  amountJpy: number;
  // 月あたりの実効価格（年額プランの割安感を出すため）
  monthlyEquivalentJpy: number;
  // 無料トライアル日数。0ならトライアルなし。
  trialDays: number;
  // Stripeダッシュボードで作成したPrice ID（環境変数で注入する）
  stripePriceIdEnv: "STRIPE_PRICE_ID_MONTHLY" | "STRIPE_PRICE_ID_YEARLY";
}

// 年額を主軸にする価格設計:
// 月あたり332円は国内競合の月額（約400-480円）を下回る一方、
// 前払いで初月の解約が消えるためLTVとキャッシュが最大化する。
// 月額680円は年額の割安感を作るためのアンカーとして置いている。
export const PRICES: Record<BillingInterval, PriceOption> = {
  YEAR: {
    interval: "YEAR",
    amountJpy: 3980,
    monthlyEquivalentJpy: 332,
    trialDays: 7,
    stripePriceIdEnv: "STRIPE_PRICE_ID_YEARLY",
  },
  MONTH: {
    interval: "MONTH",
    amountJpy: 680,
    monthlyEquivalentJpy: 680,
    trialDays: 0,
    stripePriceIdEnv: "STRIPE_PRICE_ID_MONTHLY",
  },
};

export function resolveStripePriceId(interval: BillingInterval): string {
  const priceId = process.env[PRICES[interval].stripePriceIdEnv];
  if (!priceId) {
    throw new Error(`${PRICES[interval].stripePriceIdEnv} environment variable is not set`);
  }
  return priceId;
}

// 料金ページ・LP・モバイルのペイウォールで共通に使う訴求文。
// 「無料で何ができて、有料で何が増えるか」を1箇所で管理する。
export const PRO_FEATURE_HIGHLIGHTS = [
  "AI写真解析が月150回（無料は月5回）— 1日5食分",
  "体重・食事の履歴を無期限でさかのぼれる",
  "週次・月次の自動レポート",
  "食品検索と自前food登録が無制限",
  "HealthKit / Google Fit 連携",
  "CSVエクスポート",
] as const;
