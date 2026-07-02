import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { DailySummary } from "./types";

export function useDailySummary(date: string) {
  return useQuery({
    queryKey: ["daily-summary", date],
    queryFn: () => apiFetch<DailySummary>(`/api/daily-summary?date=${date}`),
  });
}
