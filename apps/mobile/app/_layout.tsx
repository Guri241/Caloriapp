import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="meal-new"
              options={{ headerShown: true, title: "食事を記録", presentation: "modal" }}
            />
            <Stack.Screen
              name="exercise-new"
              options={{ headerShown: true, title: "運動を記録", presentation: "modal" }}
            />
            <Stack.Screen
              name="goal-new"
              options={{ headerShown: true, title: "目標を設定", presentation: "modal" }}
            />
            <Stack.Screen
              name="meal-photo"
              options={{ headerShown: true, title: "写真で記録", presentation: "modal" }}
            />
            <Stack.Screen
              name="paywall"
              options={{ headerShown: true, title: "Caloriapp Pro", presentation: "modal" }}
            />
          </Stack>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
