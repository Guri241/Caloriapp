import { router } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { colors, spacing } from "@/theme";
import { API_URL } from "@/api/client";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

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
        <Text style={styles.cardTitle}>接続先API</Text>
        <Text style={styles.apiUrl}>{API_URL}</Text>
        <Text style={styles.hint}>
          EXPO_PUBLIC_API_URL 環境変数で変更できます
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>ヘルスケア連携</Text>
        <Text style={styles.hint}>
          HealthKit / Google Fit連携は今後のアップデートで追加予定です。
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
