import { useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { FormInput } from "@/components/FormInput";
import { PaywallCard } from "@/components/PaywallCard";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ApiClientError } from "@/api/client";
import { useCreateMealLog } from "@/api/meals";
import { useSubscription } from "@/api/subscription";
import {
  captureMealPhoto,
  pickMealPhoto,
  useAnalyzeMealPhoto,
  type AnalyzedItem,
  type PreparedImage,
} from "@/api/photo";
import type { MealType } from "@/api/types";
import { colors, spacing } from "@/theme";

const MEAL_TYPES: { label: string; value: MealType }[] = [
  { label: "朝食", value: "BREAKFAST" },
  { label: "昼食", value: "LUNCH" },
  { label: "夕食", value: "DINNER" },
  { label: "間食", value: "SNACK" },
];

// 推定量を直すと、栄養値も同じ比率で動かす。
// 「ご飯を半分残した」を1操作で反映できるようにするため。
function rescale(item: AnalyzedItem, nextAmountG: number): AnalyzedItem {
  if (item.amountG <= 0) return { ...item, amountG: nextAmountG };
  const ratio = nextAmountG / item.amountG;
  return {
    name: item.name,
    amountG: nextAmountG,
    caloriesKcal: item.caloriesKcal * ratio,
    proteinG: item.proteinG * ratio,
    fatG: item.fatG * ratio,
    carbsG: item.carbsG * ratio,
  };
}

export default function MealPhotoScreen() {
  const subscription = useSubscription();
  const analyze = useAnalyzeMealPhoto();
  const createMeal = useCreateMealLog();

  const [image, setImage] = useState<PreparedImage | null>(null);
  const [hint, setHint] = useState("");
  const [items, setItems] = useState<AnalyzedItem[] | null>(null);
  const [note, setNote] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [mealType, setMealType] = useState<MealType>("LUNCH");
  const [paywallReason, setPaywallReason] = useState<string | null>(null);

  const quota = subscription.data?.usage.aiPhotoAnalysis;

  const handlePick = async (source: "camera" | "library") => {
    try {
      const picked = source === "camera" ? await captureMealPhoto() : await pickMealPhoto();
      if (!picked) {
        Alert.alert("権限が必要です", "設定アプリから写真・カメラへのアクセスを許可してください");
        return;
      }
      setImage(picked);
      setItems(null);
      setConfidence(null);
      setNote("");
    } catch (error) {
      Alert.alert("エラー", error instanceof Error ? error.message : "画像を取得できませんでした");
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    try {
      const result = await analyze.mutateAsync({ image, hint: hint || undefined });
      if (result.items.length === 0) {
        Alert.alert("解析できませんでした", result.note || "食べ物が写っていないようです");
        return;
      }
      setItems(result.items);
      setConfidence(result.confidence);
      setNote(result.note);
    } catch (error) {
      if (error instanceof ApiClientError && error.isPaywall) {
        setPaywallReason(
          error.code === "quota_exceeded"
            ? "今月のAI写真解析の上限に達しました"
            : "AI写真解析はProプランの機能です",
        );
        return;
      }
      Alert.alert("エラー", error instanceof Error ? error.message : "解析に失敗しました");
    }
  };

  const handleSave = async () => {
    if (!items || items.length === 0) return;
    try {
      await createMeal.mutateAsync({
        mealType,
        loggedAt: new Date().toISOString(),
        memo: note || undefined,
        items: items.map((item) => ({
          customName: item.name,
          amountG: item.amountG,
          caloriesKcal: item.caloriesKcal,
          proteinG: item.proteinG,
          fatG: item.fatG,
          carbsG: item.carbsG,
        })),
      });
      router.back();
    } catch (error) {
      Alert.alert("エラー", error instanceof Error ? error.message : "保存に失敗しました");
    }
  };

  if (paywallReason) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <PaywallCard reason={paywallReason} />
        <Button title="戻る" variant="secondary" onPress={() => setPaywallReason(null)} />
      </ScrollView>
    );
  }

  const totals = items?.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.caloriesKcal,
      p: acc.p + item.proteinG,
      f: acc.f + item.fatG,
      c: acc.c + item.carbsG,
    }),
    { kcal: 0, p: 0, f: 0, c: 0 },
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>食事の写真</Text>
        {image ? (
          <Image source={{ uri: image.previewUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <Text style={styles.hint}>
            料理全体が入るように、真上から撮ると精度が上がります。
          </Text>
        )}
        <View style={styles.buttonRow}>
          <View style={styles.buttonHalf}>
            <Button title="撮影する" onPress={() => handlePick("camera")} />
          </View>
          <View style={styles.buttonHalf}>
            <Button
              title="写真を選ぶ"
              variant="secondary"
              onPress={() => handlePick("library")}
            />
          </View>
        </View>
        {quota ? (
          <Text style={styles.hint}>
            今月の解析：{quota.used}
            {quota.limit === null ? "回（無制限）" : ` / ${quota.limit}回`}
          </Text>
        ) : null}
      </Card>

      {image && !items ? (
        <Card style={styles.card}>
          <FormInput
            label="補足（任意）"
            value={hint}
            onChangeText={setHint}
            placeholder="例: ラーメンの汁は残した"
            maxLength={200}
          />
          <Button title="解析する" onPress={handleAnalyze} loading={analyze.isPending} />
        </Card>
      ) : null}

      {items && totals ? (
        <>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>解析結果</Text>
            {confidence !== null ? (
              <Text style={styles.hint}>確信度 {Math.round(confidence * 100)}%</Text>
            ) : null}
            {note ? <Text style={styles.note}>{note}</Text> : null}

            {items.map((item, index) => (
              <View key={`${item.name}-${index}`} style={styles.item}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemNutrition}>
                  {Math.round(item.caloriesKcal)} kcal ／ P {item.proteinG.toFixed(1)}g ・ F{" "}
                  {item.fatG.toFixed(1)}g ・ C {item.carbsG.toFixed(1)}g
                </Text>
                <FormInput
                  label="量 (g)"
                  value={String(Math.round(item.amountG))}
                  keyboardType="decimal-pad"
                  onChangeText={(text) => {
                    const next = Number(text);
                    if (!Number.isFinite(next) || next < 0) return;
                    setItems((current) =>
                      current
                        ? current.map((entry, i) => (i === index ? rescale(entry, next) : entry))
                        : current,
                    );
                  }}
                />
              </View>
            ))}

            <Text style={styles.total}>
              合計 {Math.round(totals.kcal)} kcal ／ P {totals.p.toFixed(1)}g ・ F{" "}
              {totals.f.toFixed(1)}g ・ C {totals.c.toFixed(1)}g
            </Text>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>食事区分</Text>
            <SegmentedControl options={MEAL_TYPES} value={mealType} onChange={setMealType} />
          </Card>

          <Button title="この内容で記録する" onPress={handleSave} loading={createMeal.isPending} />
          <Button
            title="撮り直す"
            variant="secondary"
            onPress={() => {
              setItems(null);
              setImage(null);
            }}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  card: { gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  preview: { width: "100%", height: 220, borderRadius: 10, backgroundColor: colors.border },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  buttonHalf: { flex: 1 },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  note: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: 8,
  },
  item: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  itemName: { fontSize: 15, fontWeight: "600", color: colors.text },
  itemNutrition: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  total: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
    textAlign: "right",
  },
});
