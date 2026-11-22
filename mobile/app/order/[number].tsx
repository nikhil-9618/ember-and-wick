import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { API_BASE_URL, api, errorText, money } from "@/api/client";
import type { Order, PaymentIntent } from "@/api/types";
import { Button, Divider, ErrorNotice, Eyebrow, Loading, Muted } from "@/components/ui";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/auth/auth-context";
import { colors, spacing, type as typeScale } from "@/theme";

const TIMELINE: { status: Order["status"]; label: string }[] = [
  { status: "paid", label: "Payment confirmed" },
  { status: "processing", label: "Packing" },
  { status: "packed", label: "Packed" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
];

export default function OrderScreen({ }: object) {
  const { number } = useLocalSearchParams<{ number: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = useAsync(
    async () => api<{ order: Order }>(`/api/v1/orders/${encodeURIComponent(String(number))}`),
    [number, user?.id],
    { enabled: Boolean(user) },
  );

  if (!user) {
    return (
      <View style={{ flex: 1, padding: spacing.lg, backgroundColor: colors.ivory }}>
        <Text style={typeScale.title}>Sign in to view this order</Text>
        <View style={{ marginTop: spacing.lg }}>
          <Button label="Sign in" onPress={() => router.push("/login")} />
        </View>
      </View>
    );
  }

  if (state.loading) return <Loading label="Loading order" />;
  if (state.error) return <ErrorNotice message={state.error} onRetry={state.refresh} />;
  const order = state.data?.order;
  if (!order) return <ErrorNotice message="We couldn't find that order." />;

  const reached = TIMELINE.findIndex((step) => step.status === order.status);

  async function payNow() {
    setBusy(true);
    setError(null);
    try {
      const { payment } = await api<{ payment: PaymentIntent }>(
        `/api/v1/orders/${order!.number}/retry-payment`,
        { method: "POST" },
      );
      if (payment.provider === "test") {
        await api("/api/v1/payments/test-confirm", { method: "POST", body: { orderNumber: order!.number } });
        state.refresh();
        return;
      }
      await WebBrowser.openBrowserAsync(
        `${API_BASE_URL}/pay/${order!.number}#t=${encodeURIComponent(token ?? "")}`,
      );
      state.refresh();
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }

  function cancelOrder() {
    Alert.alert("Cancel order?", "Reserved items will be released.", [
      { text: "Keep order", style: "cancel" },
      {
        text: "Cancel order",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/v1/orders/${order!.number}/cancel`, { method: "POST" });
            state.refresh();
          } catch (issue) {
            setError(errorText(issue));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ivory }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.clay} />}
    >
      <Eyebrow>Order</Eyebrow>
      <Text style={typeScale.title}>{order.number}</Text>
      <Muted>{order.statusLabel}</Muted>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {order.status === "cancelled" || order.status === "refunded" ? (
          <Muted>This order is {order.status}. Reserved stock has been returned.</Muted>
        ) : (
          TIMELINE.map((step, index) => {
            const done = order.paymentStatus === "paid" && reached >= index;
            return (
              <View key={step.status} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: done ? colors.clay : colors.line,
                  }}
                />
                <Text style={{ color: done ? colors.ink : colors.inkSoft, fontSize: 13 }}>{step.label}</Text>
              </View>
            );
          })
        )}
      </View>

      {order.trackingNumber ? (
        <View style={{ marginTop: spacing.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md }}>
          <Eyebrow>Tracking</Eyebrow>
          <Text style={{ marginTop: 4 }}>
            {order.carrier ? `${order.carrier} · ` : ""}
            {order.trackingNumber}
          </Text>
        </View>
      ) : null}

      <Divider />

      {order.items.map((item) => (
        <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={typeScale.body}>{item.productName}</Text>
            <Muted>
              {item.variantName} · qty {item.quantity}
            </Muted>
          </View>
          <Text>{money(item.lineTotal)}</Text>
        </View>
      ))}

      <Divider />

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={typeScale.title}>Total</Text>
        <Text style={typeScale.title}>{money(order.total)}</Text>
      </View>
      <Muted>{order.paymentStatus.replace("_", " ")}</Muted>

      {order.address ? (
        <View style={{ marginTop: spacing.lg }}>
          <Eyebrow>Delivering to</Eyebrow>
          <Muted>
            {order.address.fullName}, {order.address.line1}
            {order.address.line2 ? `, ${order.address.line2}` : ""}, {order.address.city},{" "}
            {order.address.state} {order.address.postalCode}
          </Muted>
        </View>
      ) : null}

      {error ? <ErrorNotice message={error} /> : null}

      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        {order.canRetryPayment ? <Button label="Complete payment" onPress={payNow} busy={busy} /> : null}
        {order.canCancel ? <Button label="Cancel order" variant="outline" onPress={cancelOrder} disabled={busy} /> : null}
        <Button label="Back to orders" variant="quiet" onPress={() => router.push("/orders")} />
      </View>
    </ScrollView>
  );
}
