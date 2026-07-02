import { useState } from "react";
import { router } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { useCreateExerciseLog } from "@/api/exercise";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/FormInput";
import { colors, spacing } from "@/theme";
import { ApiClientError } from "@/api/client";

export default function ExerciseNewScreen() {
  const createExerciseLog = useCreateExerciseLog();

  const [exerciseName, setExerciseName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [caloriesBurned, setCaloriesBurned] = useState("");

  const handleSubmit = async () => {
    const calories = Number(caloriesBurned);
    if (!exerciseName || Number.isNaN(calories) || calories < 0) {
      Alert.alert("入力エラー", "運動名と消費カロリーを入力してください");
      return;
    }
    try {
      await createExerciseLog.mutateAsync({
        exerciseName,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        caloriesBurned: calories,
        performedAt: new Date().toISOString(),
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
      <ScrollView contentContainerStyle={styles.content}>
        <FormInput
          label="運動名"
          value={exerciseName}
          onChangeText={setExerciseName}
          placeholder="ランニング"
        />
        <FormInput
          label="時間 (分、任意)"
          value={durationMinutes}
          onChangeText={setDurationMinutes}
          keyboardType="number-pad"
          placeholder="30"
        />
        <FormInput
          label="消費カロリー (kcal)"
          value={caloriesBurned}
          onChangeText={setCaloriesBurned}
          keyboardType="decimal-pad"
          placeholder="250"
        />
        <Button
          title="記録する"
          onPress={handleSubmit}
          loading={createExerciseLog.isPending}
        />
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
