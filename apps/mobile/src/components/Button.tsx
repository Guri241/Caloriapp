import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, spacing } from "@/theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
}: ButtonProps) {
  const isSecondary = variant === "secondary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isSecondary ? styles.secondary : styles.primary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? colors.primary : "#fff"} />
      ) : (
        <Text style={isSecondary ? styles.secondaryText : styles.primaryText}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 16,
  },
});
