import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Food } from "./types";

// ローカルのFoodマスタ（共通マスタ+自前登録）を検索する
export function useLocalFoods(query: string) {
  return useQuery({
    queryKey: ["foods", "local", query],
    queryFn: () => apiFetch<Food[]>(`/api/foods?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
  });
}

// 検索回数の残枠。上限に達すると検索自体が402で弾かれる。
export interface QuotaState {
  used: number;
  limit: number | null;
  remaining: number | null;
}

// USDA FoodData Centralを検索する（結果はローカルFoodマスタにもキャッシュされる）
export function useUsdaFoodSearch(query: string) {
  return useQuery({
    queryKey: ["foods", "usda", query],
    queryFn: () =>
      apiFetch<{ foods: Food[]; quota: QuotaState }>(
        `/api/foods/search?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.length > 1,
    // 上限超過(402)はリトライしても成功しない
    retry: false,
  });
}

export interface CreateFoodInput {
  name: string;
  brand?: string;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  servingSizeG?: number;
}

export function useCreateFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFoodInput) =>
      apiFetch<Food>("/api/foods", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["foods"] }),
  });
}
