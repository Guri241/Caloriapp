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

// USDA FoodData Centralを検索する（結果はローカルFoodマスタにもキャッシュされる）
export function useUsdaFoodSearch(query: string) {
  return useQuery({
    queryKey: ["foods", "usda", query],
    queryFn: () => apiFetch<Food[]>(`/api/foods/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 1,
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
