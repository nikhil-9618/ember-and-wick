import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/auth/auth-context";
import { OfflineBanner } from "@/components/offline-banner";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { colors } from "@/theme";

void SplashScreen.preventAutoHideAsync();

function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    // Cold start: emberwick://product/cedar-smoked-vanilla or a universal link.
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      const path = Linking.parse(url).path;
      if (path) router.push(`/${path.replace(/^\//, "")}` as never);
    });

    const subscription = Linking.addEventListener("url", (event) => {
      const path = Linking.parse(event.url).path;
      if (path) router.push(`/${path.replace(/^\//, "")}` as never);
    });
    return () => subscription.remove();
  }, [router]);

  return null;
}

function AndroidBackHandler() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = (
      require("react-native") as typeof import("react-native")
    ).BackHandler.addEventListener("hardwareBackPress", () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false; // Let Android exit the app from the root screen.
    });
    return () => subscription.remove();
  }, [router]);

  return null;
}

function AppShell() {
  const { booting } = useAuth();
  const [ready, setReady] = useState(false);
  usePushNotifications();

  useEffect(() => {
    if (!booting) {
      setReady(true);
      void SplashScreen.hideAsync();
    }
  }, [booting]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.ivory }} />;

  return (
    <>
      <StatusBar style="dark" />
      <DeepLinkHandler />
      <AndroidBackHandler />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.ivory },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "500" },
          contentStyle: { backgroundColor: colors.ivory },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Sign in" }} />
        <Stack.Screen name="register" options={{ title: "Create account" }} />
        <Stack.Screen name="product/[slug]" options={{ title: "Candle" }} />
        <Stack.Screen name="search" options={{ title: "Search" }} />
        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="orders" options={{ title: "Your orders" }} />
        <Stack.Screen name="order/[number]" options={{ title: "Order" }} />
        <Stack.Screen name="addresses" options={{ title: "Addresses" }} />
        <Stack.Screen name="notifications" options={{ title: "Updates" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
