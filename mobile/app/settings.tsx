import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { API_BASE_URL } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { Button, Divider, Eyebrow, Muted } from "@/components/ui";
import { colors, spacing, type as typeScale } from "@/theme";

const LEGAL = [
  { path: "/privacy", label: "Privacy policy" },
  { path: "/terms", label: "Terms of service" },
  { path: "/refund-policy", label: "Returns & refunds" },
  { path: "/faq", label: "FAQs" },
];

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then((result) => setNotificationsEnabled(result.status === "granted"))
      .catch(() => setNotificationsEnabled(false));
  }, []);

  async function toggleNotifications(value: boolean) {
    if (value) {
      const result = await Notifications.requestPermissionsAsync();
      setNotificationsEnabled(result.status === "granted");
      if (result.status !== "granted") {
        Alert.alert("Notifications are off", "Enable them in your device settings to receive order updates.");
      }
    } else {
      Alert.alert(
        "Turn notifications off?",
        "You can disable Ember & Wick notifications in your device settings.",
      );
      setNotificationsEnabled(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ivory }} contentContainerStyle={{ padding: spacing.lg }}>
      <Eyebrow>Preferences</Eyebrow>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, minHeight: 48 }}>
        <View style={{ flex: 1 }}>
          <Text style={typeScale.body}>Order notifications</Text>
          <Muted>Shipping and delivery updates</Muted>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={(value) => void toggleNotifications(value)}
          accessibilityLabel="Order notifications"
        />
      </View>

      <Divider />

      <Eyebrow>About</Eyebrow>
      <Muted style={{ marginTop: spacing.sm }}>
        Ember & Wick {Constants.expoConfig?.version ?? "1.0.0"} · API {API_BASE_URL}
      </Muted>

      <Divider />

      <Eyebrow>Legal</Eyebrow>
      {LEGAL.map((item) => (
        <Pressable
          key={item.path}
          onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}${item.path}`)}
          accessibilityRole="link"
          style={{ minHeight: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.line }}
        >
          <Text style={typeScale.body}>{item.label}</Text>
        </Pressable>
      ))}

      <Muted style={{ marginTop: spacing.lg }}>
        Need help? Write to hello@emberandwick.in and we&apos;ll reply within one business day.
      </Muted>

      {user ? (
        <View style={{ marginTop: spacing.xl }}>
          <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
        </View>
      ) : null}
    </ScrollView>
  );
}
