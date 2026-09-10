import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { PaywallCard } from "@/components/PaywallCard";
import { colors, spacing } from "@/theme";

// 上限に当たった画面から遷移してくる。reasonにその機能名が入る。
export default function PaywallScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PaywallCard reason={reason} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
});
