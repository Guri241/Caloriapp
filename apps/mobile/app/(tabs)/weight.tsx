import { useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { useCreateWeightLog, useDeleteWeightLog, useWeightLogs } from "@/api/weight";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { FormInput } from "@/components/FormInput";
import { WeightChart } from "@/components/WeightChart";
import { colors, spacing } from "@/theme";
import { formatDateTimeJa } from "@/lib/date";
import { ApiClientError } from "@/api/client";
import type { WeightLog } from "@/api/types";

export default function WeightScreen() {
  const { width } = useWindowDimensions();
  const weightQuery = useWeightLogs();
  const logs = weightQuery.data?.logs ?? [];
  // 無料プランでは閲覧できる期間に上限がある（記録自体は残っている）
  const historyLimitedTo = weightQuery.data?.historyLimitedTo ?? null;
  const createMutation = useCreateWeightLog();
  const deleteMutation = useDeleteWeightLog();

  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");

  const handleAdd = async () => {
    const weight = Number(weightKg);
    if (!weight || weight <= 0) {
      Alert.alert("入力エラー", "体重を正しく入力してください");
      return;
    }
    try {
      await createMutation.mutateAsync({
        weightKg: weight,
        bodyFatPct: bodyFatPct ? Number(bodyFatPct) : undefined,
        recordedAt: new Date().toISOString(),
      });
      setWeightKg("");
      setBodyFatPct("");
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : "記録に失敗しました";
      Alert.alert("エラー", message);
    }
  };

  const handleDelete = (log: WeightLog) => {
    Alert.alert("削除確認", `${log.weightKg}kgの記録を削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: () => deleteMutation.mutate(log.id) },
    ]);
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={logs}
      keyExtractor={(item) => item.id}
      onRefresh={() => weightQuery.refetch()}
      refreshing={weightQuery.isRefetching}
      ListHeaderComponent={
        <View>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>体重推移</Text>
            <WeightChart logs={logs} width={width - spacing.md * 4} />
            {historyLimitedTo !== null ? (
              <Text style={styles.upgradeHint} onPress={() => router.push("/paywall?reason=過去の記録をすべて見るにはProが必要です")}>
                直近{historyLimitedTo}日分のみ表示中 — すべての履歴を見る
              </Text>
            ) : null}
          </Card>

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>体重を記録</Text>
            <FormInput
              label="体重 (kg)"
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
              placeholder="65.0"
            />
            <FormInput
              label="体脂肪率 (%) - 任意"
              value={bodyFatPct}
              onChangeText={setBodyFatPct}
              keyboardType="decimal-pad"
              placeholder="20.0"
            />
            <Button title="記録する" onPress={handleAdd} loading={createMutation.isPending} />
          </Card>

          <Text style={styles.listTitle}>記録一覧</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Card style={styles.logCard}>
          <View>
            <Text style={styles.logWeight}>{item.weightKg.toFixed(1)} kg</Text>
            <Text style={styles.logDate}>{formatDateTimeJa(item.recordedAt)}</Text>
          </View>
          <Text style={styles.deleteLink} onPress={() => handleDelete(item)}>
            削除
          </Text>
        </Card>
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
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
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  logCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logWeight: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  logDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  deleteLink: {
    color: colors.danger,
    fontSize: 13,
  },
  upgradeHint: {
    marginTop: spacing.sm,
    fontSize: 12.5,
    color: colors.primary,
    fontWeight: "600",
  },
});
