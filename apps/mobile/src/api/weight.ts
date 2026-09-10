import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { WeightLog } from "./types";

// 無料プランでは historyLimitedTo に閲覧可能日数が入る（グラフ上の案内に使う）
export interface WeightLogsResponse {
  logs: WeightLog[];
  historyLimitedTo: number | null;
}

export function useWeightLogs() {
  return useQuery({
    queryKey: ["weight-logs"],
    queryFn: () => apiFetch<WeightLogsResponse>("/api/weight-logs?limit=90"),
  });
}

export interface CreateWeightLogInput {
  weightKg: number;
  bodyFatPct?: number;
  recordedAt: string;
}

export function useCreateWeightLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWeightLogInput) =>
      apiFetch<WeightLog>("/api/weight-logs", { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight-logs"] });
      queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useDeleteWeightLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true }>(`/api/weight-logs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight-logs"] });
      queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}
