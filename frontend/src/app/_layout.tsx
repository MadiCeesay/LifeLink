import React, { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
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
// Opens the right screen when someone taps an alert in the store app.
function useAlertTaps(signedIn: boolean) {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (Platform.OS === "web" || !signedIn || !last) return;
    const path = last.notification.request.content.data?.path;
    if (typeof path === "string" && path.startsWith("/")) router.push(path as never);
    void Notifications.clearLastNotificationResponseAsync();
  }, [last, signedIn]);
}
function Routes() {
  const a = useAuth();
  useAlertTaps(!!a.user);
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
