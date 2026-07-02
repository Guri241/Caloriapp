import { useMemo, useState } from "react";
import { router } from "expo-router";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalFoods, useUsdaFoodSearch } from "@/api/foods";
import { useCreateMealLog, type MealLogItemInput } from "@/api/meals";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { FormInput } from "@/components/FormInput";
import { SegmentedControl } from "@/components/SegmentedControl";
import { colors, spacing } from "@/theme";
import { ApiClientError } from "@/api/client";
import type { Food, MealType } from "@/api/types";

const MEAL_TYPE_OPTIONS: { label: string; value: MealType }[] = [
  { label: "朝食", value: "BREAKFAST" },
  { label: "昼食", value: "LUNCH" },
  { label: "夕食", value: "DINNER" },
  { label: "間食", value: "SNACK" },
];

interface PendingItem extends MealLogItemInput {
  key: string;
  label: string;
  displayCalories: number;
}

export default function MealNewScreen() {
  const [mealType, setMealType] = useState<MealType>("BREAKFAST");
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [amountG, setAmountG] = useState("100");
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualAmount, setManualAmount] = useState("100");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("0");
  const [manualFat, setManualFat] = useState("0");
  const [manualCarbs, setManualCarbs] = useState("0");
  const [items, setItems] = useState<PendingItem[]>([]);

  const localFoods = useLocalFoods(query);
  const usdaFoods = useUsdaFoodSearch(query);
  const createMealLog = useCreateMealLog();

  const results = useMemo(() => {
    const local = localFoods.data ?? [];
    const usda = usdaFoods.data ?? [];
    const seen = new Set(local.map((f) => f.id));
    return [...local, ...usda.filter((f) => !seen.has(f.id))].slice(0, 20);
  }, [localFoods.data, usdaFoods.data]);

  const addFoodItem = () => {
    if (!selectedFood) return;
    const amount = Number(amountG);
    if (!amount || amount <= 0) {
      Alert.alert("入力エラー", "量(g)を正しく入力してください");
      return;
    }
    const base = selectedFood.servingSizeG ?? 100;
    const ratio = amount / base;
    setItems((prev) => [
      ...prev,
      {
        key: `${selectedFood.id}-${Date.now()}`,
        foodId: selectedFood.id,
        amountG: amount,
        label: `${selectedFood.name} (${amount}g)`,
        displayCalories: selectedFood.caloriesKcal * ratio,
      },
    ]);
    setSelectedFood(null);
    setQuery("");
    setAmountG("100");
  };

  const addManualItem = () => {
    const amount = Number(manualAmount);
    const calories = Number(manualCalories);
    if (!manualName || !amount || amount <= 0 || Number.isNaN(calories)) {
      Alert.alert("入力エラー", "品目名・量・カロリーを入力してください");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        key: `manual-${Date.now()}`,
        customName: manualName,
        amountG: amount,
        caloriesKcal: calories,
        proteinG: Number(manualProtein) || 0,
        fatG: Number(manualFat) || 0,
        carbsG: Number(manualCarbs) || 0,
        label: `${manualName} (${amount}g)`,
        displayCalories: calories,
      },
    ]);
    setManualName("");
    setManualAmount("100");
    setManualCalories("");
    setManualProtein("0");
    setManualFat("0");
    setManualCarbs("0");
    setShowManual(false);
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      Alert.alert("入力エラー", "1品目以上を追加してください");
      return;
    }
    try {
      await createMealLog.mutateAsync({
        mealType,
        loggedAt: new Date().toISOString(),
        items: items.map(({ key: _key, label: _label, displayCalories: _dc, ...rest }) => rest),
      });
      router.back();
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : "記録に失敗しました";
      Alert.alert("エラー", message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SegmentedControl options={MEAL_TYPE_OPTIONS} value={mealType} onChange={setMealType} />

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>食品を検索</Text>
          <FormInput
            label="食品名（日本語/英語どちらも検索可）"
            value={query}
            onChangeText={setQuery}
            placeholder="例: chicken breast、白米"
          />
          {query.length > 1 && (
            <View style={styles.resultList}>
              {results.map((food) => (
                <Pressable
                  key={food.id}
                  style={styles.resultRow}
                  onPress={() => setSelectedFood(food)}
                >
                  <Text style={styles.resultName} numberOfLines={1}>
                    {food.name}
                    {food.brand ? ` (${food.brand})` : ""}
                  </Text>
                  <Text style={styles.resultKcal}>
                    {Math.round(food.caloriesKcal)}kcal/{food.servingSizeG ?? 100}g
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {selectedFood && (
            <View style={styles.selectedBox}>
              <Text style={styles.selectedName}>{selectedFood.name}</Text>
              <FormInput
                label="量 (g)"
                value={amountG}
                onChangeText={setAmountG}
                keyboardType="decimal-pad"
              />
              <Button title="この品目を追加" onPress={addFoodItem} />
            </View>
          )}
        </Card>

        <Card style={styles.card}>
          <Pressable onPress={() => setShowManual((v) => !v)}>
            <Text style={styles.cardTitle}>
              {showManual ? "▼ 手入力で追加" : "▶ 手入力で追加（検索で見つからない場合）"}
            </Text>
          </Pressable>
          {showManual && (
            <View>
              <FormInput label="品目名" value={manualName} onChangeText={setManualName} />
              <FormInput
                label="量 (g)"
                value={manualAmount}
                onChangeText={setManualAmount}
                keyboardType="decimal-pad"
              />
              <FormInput
                label="カロリー (kcal)"
                value={manualCalories}
                onChangeText={setManualCalories}
                keyboardType="decimal-pad"
              />
              <FormInput
                label="たんぱく質 (g)"
                value={manualProtein}
                onChangeText={setManualProtein}
                keyboardType="decimal-pad"
              />
              <FormInput
                label="脂質 (g)"
                value={manualFat}
                onChangeText={setManualFat}
                keyboardType="decimal-pad"
              />
              <FormInput
                label="炭水化物 (g)"
                value={manualCarbs}
                onChangeText={setManualCarbs}
                keyboardType="decimal-pad"
              />
              <Button title="この品目を追加" onPress={addManualItem} variant="secondary" />
            </View>
          )}
        </Card>

        {items.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>追加する品目</Text>
            <FlatList
              data={items}
              keyExtractor={(item) => item.key}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.itemRow}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemKcal}>{Math.round(item.displayCalories)}kcal</Text>
                  <Text style={styles.deleteLink} onPress={() => removeItem(item.key)}>
                    削除
                  </Text>
                </View>
              )}
            />
          </Card>
        )}

        <Button
          title="食事を記録する"
          onPress={handleSubmit}
          loading={createMealLog.isPending}
        />
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
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
  resultList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  resultName: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  resultKcal: {
    fontSize: 12,
    color: colors.textMuted,
  },
  selectedBox: {
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  itemLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  itemKcal: {
    fontSize: 13,
    color: colors.textMuted,
  },
  deleteLink: {
    color: colors.danger,
    fontSize: 12,
  },
});
