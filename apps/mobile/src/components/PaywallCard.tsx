import { Alert, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { Card } from "./Card";
import { colors, spacing } from "@/theme";
import { openCheckout, useSubscription } from "@/api/subscription";

interface PaywallCardProps {
  // 上限に当たった機能名など、なぜ課金が必要かを具体的に伝える文言
  reason?: string;
}

// 価格と訴求文はサーバー(/api/me/subscription)から取得する。
// アプリを再申請せずに価格改定やコピー変更ができるようにするため。
export function PaywallCard({ reason }: PaywallCardProps) {
  const { data } = useSubscription();
  const year = data?.pricing.year;
  const highlights = data?.pricing.proHighlights ?? [];

  const handleUpgrade = async () => {
    try {
      await openCheckout();
    } catch {
      Alert.alert("エラー", "決済ページを開けませんでした");
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.badge}>Pro</Text>
      <Text style={styles.title}>
        {reason ?? "上限に達しました"}
      </Text>

      {year ? (
        <Text style={styles.price}>
          月あたり{year.monthlyEquivalentJpy}円
          <Text style={styles.priceSub}>
            {"  "}年額{year.amountJpy.toLocaleString("ja-JP")}円
            {year.trialDays > 0 ? `・${year.trialDays}日間無料` : ""}
          </Text>
        </Text>
      ) : null}

      <View style={styles.list}>
        {highlights.map((item) => (
          <Text key={item} style={styles.listItem}>
            ・{item}
          </Text>
        ))}
      </View>

      <Button title="Proにアップグレード" onPress={handleUpgrade} />
      <Text style={styles.note}>
        決済はブラウザで安全に行われます。いつでも解約でき、解約後も支払い済みの期間はProのままです。
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  price: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  priceSub: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textMuted,
  },
  list: {
    gap: 4,
    marginVertical: spacing.xs,
  },
  listItem: {
    fontSize: 13.5,
    color: colors.textMuted,
    lineHeight: 20,
  },
  note: {
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 17,
  },
});
