import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { API_URL, apiFetch } from "./client";

export interface QuotaState {
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface PlanLimits {
  aiPhotoAnalysesPerMonth: number | null;
  foodSearchesPerMonth: number | null;
  customFoods: number | null;
  historyDays: number | null;
  weeklyReport: boolean;
  csvExport: boolean;
  healthSync: boolean;
}

export interface PriceOption {
  interval: "MONTH" | "YEAR";
  amountJpy: number;
  monthlyEquivalentJpy: number;
  trialDays: number;
}

export interface SubscriptionState {
  tier: "FREE" | "PRO";
  isPro: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  limits: PlanLimits;
  usage: { aiPhotoAnalysis: QuotaState; foodSearch: QuotaState };
  pricing: {
    year: PriceOption;
    month: PriceOption;
    proHighlights: string[];
    freeLimits: PlanLimits;
  };
}

// 価格も上限もサーバーから受け取る。アプリを更新せずに値段やプラン構成を変えられる。
export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () => apiFetch<SubscriptionState>("/api/me/subscription"),
    staleTime: 60_000,
  });
}

// 課金枠を使う操作の後に呼ぶと、残枠表示が最新になる。
export function useRefreshSubscription() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["subscription"] });
}

// 決済はアプリ内ではなくブラウザのWeb決済ページで行う。
// ストア手数料(15-30%)がかからないぶん、同等機能を安く提供できる。
export async function openCheckout(): Promise<void> {
  await Linking.openURL(`${API_URL}/pricing`);
}

// 支払い方法の変更・解約はStripeのCustomer Portalに任せる。
export async function openBillingPortal(): Promise<void> {
  const { url } = await apiFetch<{ url: string }>("/api/billing/portal", { method: "POST" });
  await Linking.openURL(url);
}
