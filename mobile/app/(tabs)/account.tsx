import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { Button, Divider, Eyebrow, Muted } from "@/components/ui";
import { colors, spacing, type as typeScale } from "@/theme";

const LINKS = [
  { href: "/orders", label: "Your orders", hint: "Track and manage deliveries" },
  { href: "/addresses", label: "Addresses", hint: "Saved delivery addresses" },
  { href: "/notifications", label: "Updates", hint: "Order and shipping notices" },
  { href: "/settings", label: "Settings", hint: "Notifications and app info" },
];

export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ivory, padding: spacing.lg }}>
        <Eyebrow>Welcome</Eyebrow>
        <Text style={typeScale.display}>Your account</Text>
        <Muted style={{ marginTop: spacing.sm }}>
          Sign in to keep your cart, wishlist and orders in sync with the website.
        </Muted>
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button label="Sign in" onPress={() => router.push("/login")} />
          <Button label="Create an account" onPress={() => router.push("/register")} variant="outline" />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ivory }} contentContainerStyle={{ padding: spacing.lg }}>
      <Eyebrow>Signed in</Eyebrow>
      <Text style={typeScale.title}>{user.name}</Text>
      <Muted>{user.email}</Muted>
      {user.phone ? <Muted>{user.phone}</Muted> : null}

      <Divider />

      {LINKS.map((link) => (
        <Pressable
          key={link.href}
          onPress={() => router.push(link.href as never)}
          accessibilityRole="button"
          accessibilityLabel={link.label}
          style={styles.row}
        >
          <View>
            <Text style={typeScale.body}>{link.label}</Text>
            <Muted>{link.hint}</Muted>
          </View>
          <Text style={typeScale.small}>→</Text>
        </Pressable>
      ))}

      <View style={{ marginTop: spacing.xl }}>
        <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    minHeight: 56,
  },
});
