import { useState } from "react";
import { router } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { useCreateGoal } from "@/api/goals";
import { useWeightLogs } from "@/api/weight";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/FormInput";
import { colors, spacing } from "@/theme";
import { ApiClientError } from "@/api/client";

export default function GoalNewScreen() {
  const weightQuery = useWeightLogs();
  const createGoal = useCreateGoal();

  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [startWeightKg, setStartWeightKg] = useState(
    weightQuery.data?.logs[0]?.weightKg.toString() ?? "",
  );
  const [targetDate, setTargetDate] = useState("");

  const handleSubmit = async () => {
    const target = Number(targetWeightKg);
    const start = Number(startWeightKg);
    if (!target || target <= 0 || !start || start <= 0) {
      Alert.alert("入力エラー", "目標体重と開始体重を正しく入力してください");
      return;
    }
    try {
      await createGoal.mutateAsync({
        targetWeightKg: target,
        startWeightKg: start,
        startDate: new Date().toISOString(),
        targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
      });
      router.back();
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : "設定に失敗しました";
      Alert.alert("エラー", message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <FormInput
          label="目標体重 (kg)"
          value={targetWeightKg}
          onChangeText={setTargetWeightKg}
          keyboardType="decimal-pad"
          placeholder="60.0"
        />
        <FormInput
          label="開始体重 (kg)"
          value={startWeightKg}
          onChangeText={setStartWeightKg}
          keyboardType="decimal-pad"
          placeholder="65.0"
        />
        <FormInput
          label="目標期限 (YYYY-MM-DD、任意)"
          value={targetDate}
          onChangeText={setTargetDate}
          placeholder="2026-12-31"
        />
        <Button title="設定する" onPress={handleSubmit} loading={createGoal.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.md,
  },
});
