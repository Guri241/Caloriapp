import { router } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useDeleteMealLog, useMealLogs } from "@/api/meals";
import { Card } from "@/components/Card";
import { colors, spacing } from "@/theme";
import { formatDateTimeJa } from "@/lib/date";
import type { MealLog, MealType } from "@/api/types";

const MEAL_TYPE_LABEL: Record<MealType, string> = {
  BREAKFAST: "朝食",
  LUNCH: "昼食",
  DINNER: "夕食",
  SNACK: "間食",
};

function mealCalories(meal: MealLog): number {
  return meal.items.reduce((sum, item) => sum + item.caloriesKcal, 0);
}

export default function MealsScreen() {
  const mealLogsQuery = useMealLogs();
  const deleteMutation = useDeleteMealLog();

  const handleDelete = (meal: MealLog) => {
    Alert.alert("削除確認", "この食事記録を削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: () => deleteMutation.mutate(meal.id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={mealLogsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        onRefresh={() => mealLogsQuery.refetch()}
        refreshing={mealLogsQuery.isRefetching}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>まだ食事の記録がありません</Text>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.headerRow}>
              <Text style={styles.mealType}>{MEAL_TYPE_LABEL[item.mealType]}</Text>
              <Text style={styles.mealKcal}>{Math.round(mealCalories(item))} kcal</Text>
            </View>
            <Text style={styles.mealDate}>{formatDateTimeJa(item.loggedAt)}</Text>
            {item.items.map((mealItem) => (
              <Text key={mealItem.id} style={styles.itemText}>
                ・{mealItem.food?.name ?? mealItem.customName} ({mealItem.amountG}g /{" "}
                {Math.round(mealItem.caloriesKcal)}kcal)
              </Text>
            ))}
            <Text style={styles.deleteLink} onPress={() => handleDelete(item)}>
              削除
            </Text>
          </Card>
        )}
      />
      <Pressable style={styles.fab} onPress={() => router.push("/meal-new")}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    flexGrow: 1,
  },
  emptyText: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  mealType: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  mealKcal: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  mealDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  itemText: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
  },
  deleteLink: {
    color: colors.danger,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 30,
  },
});
