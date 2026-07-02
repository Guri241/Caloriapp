import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Goal } from "./types";

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: () => apiFetch<Goal[]>("/api/goals"),
  });
}

export interface CreateGoalInput {
  targetWeightKg: number;
  startWeightKg: number;
  startDate: string;
  targetDate?: string;
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGoalInput) =>
      apiFetch<Goal>("/api/goals", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}
