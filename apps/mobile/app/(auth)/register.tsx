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

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert("入力エラー", "メールアドレスとパスワードを入力してください");
      return;
    }
    if (password.length < 8) {
      Alert.alert("入力エラー", "パスワードは8文字以上で入力してください");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, name || undefined);
      router.replace("/(tabs)/dashboard");
    } catch (error) {
      const message =
        error instanceof ApiClientError ? error.message : "登録に失敗しました";
      Alert.alert("登録エラー", message);
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
        <Text style={styles.title}>アカウント作成</Text>

        <View style={styles.form}>
          <FormInput label="名前（任意）" value={name} onChangeText={setName} placeholder="山田太郎" />
          <FormInput
            label="メールアドレス"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <FormInput
            label="パスワード（8文字以上）"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="********"
          />
          <Button title="登録する" onPress={handleSubmit} loading={loading} />
        </View>

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkText}>すでにアカウントをお持ちの方はこちら</Text>
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
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
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
