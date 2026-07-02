import { router } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useGoals } from "@/api/goals";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { colors, spacing } from "@/theme";
import { formatDateJa } from "@/lib/date";
import type { Goal } from "@/api/types";

export default function GoalsScreen() {
  const goalsQuery = useGoals();
  const goals = goalsQuery.data ?? [];
  const activeGoal = goals.find((g) => g.isActive);
  const pastGoals = goals.filter((g) => !g.isActive);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={pastGoals}
      keyExtractor={(item) => item.id}
      onRefresh={() => goalsQuery.refetch()}
      refreshing={goalsQuery.isRefetching}
      ListHeaderComponent={
        <View>
          {activeGoal ? (
            <GoalCard goal={activeGoal} highlight />
          ) : (
            <Card style={styles.card}>
              <Text style={styles.emptyText}>現在アクティブな目標はありません</Text>
            </Card>
          )}
          <Button title="新しい目標を設定" onPress={() => router.push("/goal-new")} />
          {pastGoals.length > 0 && <Text style={styles.historyTitle}>過去の目標</Text>}
        </View>
      }
      renderItem={({ item }) => <GoalCard goal={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
  );
}

function GoalCard({ goal, highlight }: { goal: Goal; highlight?: boolean }) {
  return (
    <Card style={[styles.card, highlight && styles.activeCard]}>
      {highlight && <Text style={styles.activeLabel}>アクティブな目標</Text>}
      <View style={styles.row}>
        <Text style={styles.label}>目標体重</Text>
        <Text style={styles.value}>{goal.targetWeightKg.toFixed(1)} kg</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>開始体重</Text>
        <Text style={styles.value}>{goal.startWeightKg.toFixed(1)} kg</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>開始日</Text>
        <Text style={styles.value}>{formatDateJa(goal.startDate)}</Text>
      </View>
      {goal.targetDate && (
        <View style={styles.row}>
          <Text style={styles.label}>目標期限</Text>
          <Text style={styles.value}>{formatDateJa(goal.targetDate)}</Text>
        </View>
      )}
      <View style={styles.row}>
        <Text style={styles.label}>進捗率</Text>
        <Text style={styles.value}>
          {goal.progressPct != null ? `${goal.progressPct}%` : "記録待ち"}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  activeCard: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  emptyText: {
    textAlign: "center",
    color: colors.textMuted,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
