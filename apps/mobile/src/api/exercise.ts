import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { ExerciseLog } from "./types";

export function useExerciseLogs() {
  return useQuery({
    queryKey: ["exercise-logs"],
    queryFn: () => apiFetch<ExerciseLog[]>("/api/exercise-logs?limit=90"),
  });
}

export interface CreateExerciseLogInput {
  exerciseName: string;
  durationMinutes?: number;
  caloriesBurned: number;
  performedAt: string;
}

export function useCreateExerciseLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExerciseLogInput) =>
      apiFetch<ExerciseLog>("/api/exercise-logs", { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercise-logs"] });
      queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
    },
  });
}
