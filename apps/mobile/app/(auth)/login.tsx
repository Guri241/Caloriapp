import { useState } from "react";
import { Link, router } from "expo-router";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/FormInput";
import { colors, spacing } from "@/theme";
import { ApiClientError } from "@/api/client";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert("入力エラー", "メールアドレスとパスワードを入力してください");
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/(tabs)/dashboard");
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : "ログインに失敗しました";
      Alert.alert("ログインエラー", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Caloriapp</Text>
        <Text style={styles.subtitle}>体重・食事・運動を記録して目標達成へ</Text>

        <View style={styles.form}>
          <FormInput
            label="メールアドレス"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <FormInput
            label="パスワード"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="********"
          />
          <Button title="ログイン" onPress={handleSubmit} loading={loading} />
        </View>

        <Link href="/(auth)/register" style={styles.link}>
          <Text style={styles.linkText}>アカウントをお持ちでない方はこちら</Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  form: {
    marginBottom: spacing.lg,
  },
  link: {
    alignSelf: "center",
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
  },
});
