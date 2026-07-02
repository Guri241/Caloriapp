import { router } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDailySummary } from "@/api/dailySummary";
import { useExerciseLogs } from "@/api/exercise";
import { useGoals } from "@/api/goals";
import { useWeightLogs } from "@/api/weight";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { colors, spacing } from "@/theme";
import { todayDateString } from "@/lib/date";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const today = todayDateString();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const summaryQuery = useDailySummary(today);
  const goalsQuery = useGoals();
  const weightQuery = useWeightLogs();
  const exerciseQuery = useExerciseLogs();

  const activeGoal = goalsQuery.data?.find((g) => g.isActive);
  const latestWeight = weightQuery.data?.[0];
  const summary = summaryQuery.data;
  const todayExercises = (exerciseQuery.data ?? []).filter(
    (log) => log.performedAt.slice(0, 10) === today,
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["daily-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["goals"] }),
      queryClient.invalidateQueries({ queryKey: ["weight-logs"] }),
      queryClient.invalidateQueries({ queryKey: ["exercise-logs"] }),
    ]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.actionsRow}>
        <View style={styles.actionButton}>
          <Button title="食事を記録" onPress={() => router.push("/meal-new")} />
        </View>
        <View style={styles.actionButton}>
          <Button
            title="運動を記録"
            variant="secondary"
            onPress={() => router.push("/exercise-new")}
          />
        </View>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>今日のカロリー収支</Text>
        <StatRow label="摂取カロリー" value={`${Math.round(summary?.totalIntakeKcal ?? 0)} kcal`} />
        <StatRow label="消費カロリー" value={`${Math.round(summary?.totalBurnedKcal ?? 0)} kcal`} />
        <View style={styles.divider} />
        <StatRow
          label="収支"
          value={`${summary && summary.netCaloriesKcal >= 0 ? "+" : ""}${Math.round(summary?.netCaloriesKcal ?? 0)} kcal`}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>PFCバランス</Text>
        <StatRow label="たんぱく質" value={`${Math.round(summary?.totalProteinG ?? 0)} g`} />
        <StatRow label="脂質" value={`${Math.round(summary?.totalFatG ?? 0)} g`} />
        <StatRow label="炭水化物" value={`${Math.round(summary?.totalCarbsG ?? 0)} g`} />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>体重</Text>
        <StatRow
          label="最新記録"
          value={latestWeight ? `${latestWeight.weightKg.toFixed(1)} kg` : "記録なし"}
        />
      </Card>

      {activeGoal && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>目標進捗</Text>
          <StatRow label="目標体重" value={`${activeGoal.targetWeightKg.toFixed(1)} kg`} />
          <StatRow label="開始体重" value={`${activeGoal.startWeightKg.toFixed(1)} kg`} />
          <StatRow
            label="進捗率"
            value={activeGoal.progressPct != null ? `${activeGoal.progressPct}%` : "-"}
          />
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>今日の運動</Text>
        {todayExercises.length === 0 ? (
          <Text style={styles.emptyText}>記録がありません</Text>
        ) : (
          todayExercises.map((log) => (
            <StatRow
              key={log.id}
              label={log.exerciseName}
              value={`${Math.round(log.caloriesBurned)} kcal`}
            />
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
