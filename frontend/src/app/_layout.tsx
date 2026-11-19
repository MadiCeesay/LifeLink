import React, { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { Stack } from "expo-router";
import { AlertTaps } from "../features/common/AlertTaps";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { queryClient } from "../providers/query";
import { AuthProvider, useAuth } from "../providers/AuthProvider";
import { Button, ErrorState, Loading, Screen } from "../components/ui";
function Routes() {
  const a = useAuth();
  if (a.loading) return <Loading />;
  if (a.error && !a.user)
    return (
      <Screen title="LifeLink">
        <ErrorState error={new Error(a.error)} retry={() => void a.restore()} />
        <Button
          title="Sign out of saved session"
          variant="secondary"
          onPress={() => void a.logout()}
        />
      </Screen>
    );
  return (
    <>
      {Platform.OS !== "web" && a.user ? <AlertTaps /> : null}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!a.user}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={a.user?.role === "DONOR"}>
          <Stack.Screen name="(donor)" />
          <Stack.Screen name="donor" />
        </Stack.Protected>
        <Stack.Protected guard={a.user?.role === "FACILITY_USER"}>
          <Stack.Screen name="(facility)" />
          <Stack.Screen name="facility" />
        </Stack.Protected>
        <Stack.Protected guard={a.user?.role === "ADMIN"}>
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="admin" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
export default function Layout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  useEffect(() => {
    const l = AppState.addEventListener("change", (s) =>
      focusManager.setFocused(s === "active"),
    );
    return () => l.remove();
  }, []);
  if (!loaded && !error) return <Loading />;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <Routes />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
