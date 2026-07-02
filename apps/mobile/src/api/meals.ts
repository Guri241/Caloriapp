import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { MealLog, MealType } from "./types";

export function useMealLogs(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("limit", "100");

  return useQuery({
    queryKey: ["meal-logs", from, to],
    queryFn: () => apiFetch<MealLog[]>(`/api/meal-logs?${params.toString()}`),
  });
}

export interface MealLogItemInput {
  foodId?: string;
  customName?: string;
  amountG: number;
  caloriesKcal?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
}

export interface CreateMealLogInput {
  mealType: MealType;
  loggedAt: string;
  memo?: string;
  items: MealLogItemInput[];
}

export function useCreateMealLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMealLogInput) =>
      apiFetch<MealLog>("/api/meal-logs", { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-logs"] });
      queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
    },
  });
}

export function useDeleteMealLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true }>(`/api/meal-logs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-logs"] });
      queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
    },
  });
}
