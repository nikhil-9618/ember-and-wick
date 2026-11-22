import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, errorText, money } from "@/api/client";
import type { Cart } from "@/api/types";
import { absoluteImage } from "@/components/product-card";
import { Button, Divider, EmptyState, ErrorNotice, Loading, Muted } from "@/components/ui";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/auth/auth-context";
import { colors, spacing, type as typeScale } from "@/theme";
import { useState } from "react";

export default function CartScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [busyVariant, setBusyVariant] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const state = useAsync(async () => api<Cart>("/api/v1/cart"), [user?.id], { enabled: Boolean(user) });

  if (!user) {
    return (
      <EmptyState
        title="Sign in to see your cart"
        body="Your cart is saved to your account so it stays in sync with the website."
        action={<Button label="Sign in" onPress={() => router.push("/login")} />}
      />
    );
  }

  if (state.loading) return <Loading label="Loading cart" />;
  if (state.error) return <ErrorNotice message={state.error} onRetry={state.refresh} />;

  const cart = state.data;
  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        body="Find a candle that suits the room you're in."
        action={<Button label="Shop candles" onPress={() => router.push("/(tabs)/shop")} />}
      />
    );
  }

  async function update(variantId: string, quantity: number) {
    setBusyVariant(variantId);
    setError(null);
    try {
      await api("/api/v1/cart", { method: "PATCH", body: { variantId, quantity } });
      state.refresh();
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusyVariant(null);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ivory }}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.clay} />}
    >
      <View style={{ padding: spacing.lg }}>
        {cart.items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Image
              source={{ uri: absoluteImage(item.imageUrl ?? "") }}
              style={styles.thumb}
              contentFit="cover"
              accessibilityLabel={item.imageAlt ?? item.productName}
            />
            <View style={{ flex: 1 }}>
              <Text style={typeScale.body}>{item.productName}</Text>
              <Muted>{item.variantName}</Muted>
              <Muted>{money(item.unitPrice)} each</Muted>
              <View style={styles.qtyRow}>
                <Pressable
                  onPress={() => update(item.variantId, item.quantity - 1)}
                  disabled={busyVariant === item.variantId}
                  accessibilityLabel={`Decrease ${item.productName} quantity`}
                  style={styles.qtyButton}
                >
                  <Text>−</Text>
                </Pressable>
                <Text style={{ minWidth: 24, textAlign: "center" }}>{item.quantity}</Text>
                <Pressable
                  onPress={() => update(item.variantId, item.quantity + 1)}
                  disabled={busyVariant === item.variantId || item.quantity >= item.stock}
                  accessibilityLabel={`Increase ${item.productName} quantity`}
                  style={styles.qtyButton}
                >
                  <Text>+</Text>
                </Pressable>
                <Pressable onPress={() => update(item.variantId, 0)} accessibilityLabel="Remove item" style={{ marginLeft: spacing.md }}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            </View>
            <Text style={typeScale.body}>{money(item.lineTotal)}</Text>
          </View>
        ))}

        {error ? <ErrorNotice message={error} /> : null}

        <Divider />

        <View style={styles.summaryRow}>
          <Muted>Subtotal</Muted>
          <Text>{money(cart.subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Muted>Shipping</Muted>
          <Text>{cart.totals.shippingFee === 0 ? "Free" : money(cart.totals.shippingFee)}</Text>
        </View>
        <View style={[styles.summaryRow, { marginTop: spacing.sm }]}>
          <Text style={typeScale.title}>Total</Text>
          <Text style={typeScale.title}>{money(cart.totals.total)}</Text>
        </View>
        <Muted>Includes {money(cart.totals.tax)} GST</Muted>

        <View style={{ marginTop: spacing.lg }}>
          <Button label="Continue to checkout" onPress={() => router.push("/checkout")} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  thumb: { width: 84, height: 84, backgroundColor: colors.sand },
  qtyRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  qtyButton: { width: 36, height: 36, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  remove: { fontSize: 12, color: colors.clayDark, textDecorationLine: "underline" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
});
