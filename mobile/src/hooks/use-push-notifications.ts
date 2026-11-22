import { useEffect } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "@/api/client";
import { useAuth } from "@/auth/auth-context";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/**
 * Registers the device for order updates.
 *
 * Registering the token is implemented end to end. Actually *delivering* a push
 * requires an Expo project id plus FCM/APNs credentials on the EAS project, which
 * is a deployment step documented in DEPLOYMENT.md.
 */
export function usePushNotifications(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        if (!Device.isDevice) return;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("orders", {
            name: "Order updates",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== "granted") {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }
        if (status !== "granted") return;

        const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
        if (!projectId) return; // Push delivery is not configured for this build.
        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled) return;

        await api("/api/v1/devices", {
          method: "POST",
          body: { token: token.data, platform: Platform.OS },
        });
      } catch {
        // Push is best-effort: never block the app because registration failed.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);
}
