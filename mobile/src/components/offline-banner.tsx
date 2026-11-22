import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/theme";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return unsubscribe;
  }, []);

  if (!offline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.text}>You&apos;re offline. Some content may be out of date.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.clay, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  text: { color: colors.ivory, fontSize: 12, textAlign: "center" },
});
