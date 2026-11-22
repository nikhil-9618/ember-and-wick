import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api, money } from "@/api/client";
import type { Order } from "@/api/types";
import { Button, EmptyState, ErrorNotice, Loading, Muted } from "@/components/ui";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/auth/auth-context";
import { colors, spacing, type as typeScale } from "@/theme";

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const state = useAsync(async () => api<{ orders: Order[] }>("/api/v1/orders"), [user?.id], {
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <EmptyState
        title="Sign in to see orders"
        body="Your order history and tracking live in your account."
        action={<Button label="Sign in" onPress={() => router.push("/login")} />}
      />
    );
  }

  if (state.loading) return <Loading label="Loading orders" />;
  if (state.error) return <ErrorNotice message={state.error} onRetry={state.refresh} />;

  const orders = state.data?.orders ?? [];
  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        body="When you place an order it will appear here with live tracking."
        action={<Button label="Shop candles" onPress={() => router.push("/(tabs)/shop")} />}
      />
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.ivory }}
      contentContainerStyle={{ padding: spacing.lg }}
      data={orders}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.clay} />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/order/${item.number}`)}
          accessibilityRole="button"
          accessibilityLabel={`Order ${item.number}, ${item.statusLabel}`}
          style={styles.row}
        >
          <View style={{ flex: 1 }}>
            <Text style={typeScale.body}>{item.number}</Text>
            <Muted>
              {new Date(item.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} ·{" "}
              {item.items.reduce((sum, line) => sum + line.quantity, 0)} items
            </Muted>
            <Text style={[typeScale.small, { color: colors.sage }]}>{item.statusLabel}</Text>
          </View>
          <Text>{money(item.total)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    minHeight: 64,
  },
});
