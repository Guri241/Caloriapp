import { router } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { colors, spacing } from "@/theme";
import { API_URL } from "@/api/client";
import { openBillingPortal, openCheckout, useSubscription } from "@/api/subscription";

function formatQuota(quota: { used: number; limit: number | null }): string {
  return quota.limit === null ? `${quota.used}回（無制限）` : `${quota.used} / ${quota.limit}回`;
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const subscription = useSubscription();
  const plan = subscription.data;

  const handleUpgrade = async () => {
    try {
      await openCheckout();
    } catch {
      Alert.alert("エラー", "決済ページを開けませんでした");
    }
  };

  const handleManage = async () => {
    try {
      await openBillingPortal();
    } catch (error) {
      Alert.alert("エラー", error instanceof Error ? error.message : "請求ページを開けませんでした");
    }
  };

  const handleLogout = () => {
    Alert.alert("ログアウト", "ログアウトしますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "ログアウト",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>アカウント</Text>
        <View style={styles.row}>
          <Text style={styles.label}>名前</Text>
          <Text style={styles.value}>{user?.name ?? "未設定"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>メールアドレス</Text>
          <Text style={styles.value}>{user?.email}</Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>プラン</Text>
        <View style={styles.row}>
          <Text style={styles.label}>現在のプラン</Text>
          <Text style={styles.value}>{plan?.tier === "PRO" ? "Pro" : "Free"}</Text>
        </View>
        {plan ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>今月のAI写真解析</Text>
              <Text style={styles.value}>{formatQuota(plan.usage.aiPhotoAnalysis)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>今月の食品検索</Text>
              <Text style={styles.value}>{formatQuota(plan.usage.foodSearch)}</Text>
            </View>
            {plan.isPro ? (
              <>
                <Text style={styles.hint}>
                  {plan.cancelAtPeriodEnd
                    ? `${new Date(plan.currentPeriodEnd ?? "").toLocaleDateString("ja-JP")}に解約予定です。それまではProのまま使えます。`
                    : plan.status === "TRIALING"
                      ? `無料トライアル中（${new Date(plan.trialEndsAt ?? "").toLocaleDateString("ja-JP")}まで）`
                      : `次回更新日：${new Date(plan.currentPeriodEnd ?? "").toLocaleDateString("ja-JP")}`}
                </Text>
                <Button title="支払い方法・解約の管理" onPress={handleManage} variant="secondary" />
              </>
            ) : (
              <>
                <Text style={styles.hint}>
                  年額{plan.pricing.year.amountJpy.toLocaleString("ja-JP")}円（月あたり
                  {plan.pricing.year.monthlyEquivalentJpy}円）でAI解析と全履歴が解放されます。
                </Text>
                <Button title="Proにアップグレード" onPress={handleUpgrade} />
              </>
            )}
          </>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>接続先API</Text>
        <Text style={styles.apiUrl}>{API_URL}</Text>
        <Text style={styles.hint}>
          EXPO_PUBLIC_API_URL 環境変数で変更できます
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>ヘルスケア連携</Text>
        <Text style={styles.hint}>
          {plan?.limits.healthSync
            ? "HealthKit / Google Fitからの同期に対応しています（アプリ側の実装は今後追加予定）。"
            : "HealthKit / Google Fit連携はProプランの機能です。"}
        </Text>
      </Card>

      <Button title="ログアウト" onPress={handleLogout} variant="secondary" />
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
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
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
  apiUrl: {
    fontSize: 13,
    color: colors.text,
    fontFamily: "monospace",
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
