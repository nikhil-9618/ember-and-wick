import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { API_BASE_URL, api, errorText, money } from "@/api/client";
import type { Address, Cart, PaymentIntent } from "@/api/types";
import { Button, Divider, ErrorNotice, Eyebrow, Field, Loading, Muted } from "@/components/ui";
import { useAuth } from "@/auth/auth-context";
import { useAsync } from "@/hooks/use-async";
import { colors, spacing, type as typeScale } from "@/theme";

interface OrderResponse {
  order: { id: string; number: string; total: number };
  payment: PaymentIntent;
}

const EMPTY = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
};

export default function CheckoutScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [addressId, setAddressId] = useState<string | null>(null);
  const [useNew, setUseNew] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [coupon, setCoupon] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<OrderResponse | null>(null);
  const idempotencyKey = useMemo(() => `mob-${Date.now()}-${Math.floor(Math.random() * 100000)}`, []);

  const state = useAsync(
    async () => {
      const [cart, addresses] = await Promise.all([
        api<Cart>("/api/v1/cart"),
        api<{ addresses: Address[] }>("/api/v1/addresses"),
      ]);
      return { cart, addresses: addresses.addresses };
    },
    [user?.id],
    { enabled: Boolean(user) },
  );

  if (!user) {
    return (
      <View style={{ flex: 1, padding: spacing.lg, backgroundColor: colors.ivory }}>
        <Eyebrow>Checkout</Eyebrow>
        <Text style={typeScale.title}>Sign in to check out</Text>
        <View style={{ marginTop: spacing.lg }}>
          <Button label="Sign in" onPress={() => router.push("/login")} />
        </View>
      </View>
    );
  }

  if (state.loading) return <Loading label="Preparing checkout" />;
  if (state.error) return <ErrorNotice message={state.error} onRetry={state.refresh} />;

  const cart = state.data?.cart;
  const addresses = state.data?.addresses ?? [];
  if (!cart || cart.items.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg, backgroundColor: colors.ivory }}>
        <Text style={typeScale.title}>Your cart is empty</Text>
        <View style={{ marginTop: spacing.lg }}>
          <Button label="Shop candles" onPress={() => router.push("/(tabs)/shop")} />
        </View>
      </View>
    );
  }

  const selectedId = addressId ?? addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? null;
  const showNewForm = useNew || addresses.length === 0;

  async function placeOrder() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        couponCode: coupon.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey,
      };
      if (showNewForm) {
        body.address = { ...draft, line2: draft.line2 || undefined, country: "IN" };
      } else {
        body.addressId = selectedId;
      }

      const result = await api<OrderResponse>("/api/v1/orders", { method: "POST", body });
      setPending(result);

      if (result.payment.provider === "test") {
        await api("/api/v1/payments/test-confirm", { method: "POST", body: { orderNumber: result.order.number } });
        router.replace(`/order/${result.order.number}?paid=1`);
        return;
      }

      // Razorpay requires its checkout JS. Open our hosted pay page in an
      // in-app browser; the session token is passed in the URL fragment so it
      // never reaches a server log.
      const url = `${API_BASE_URL}/pay/${result.order.number}#t=${encodeURIComponent(token ?? "")}`;
      await WebBrowser.openBrowserAsync(url);
      router.replace(`/order/${result.order.number}`);
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof EMPTY, label: string, props: Record<string, unknown> = {}) => (
    <Field
      label={label}
      value={draft[key]}
      onChangeText={(value) => setDraft({ ...draft, [key]: value })}
      {...props}
    />
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.ivory }} contentContainerStyle={{ padding: spacing.lg }}>
        <Eyebrow>Delivery</Eyebrow>

        {addresses.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {addresses.map((address) => {
              const active = !showNewForm && selectedId === address.id;
              return (
                <Pressable
                  key={address.id}
                  onPress={() => {
                    setUseNew(false);
                    setAddressId(address.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    borderWidth: 1,
                    borderColor: active ? colors.ink : colors.line,
                    padding: spacing.md,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>
                    {address.fullName}
                    {address.isDefault ? "  · default" : ""}
                  </Text>
                  <Muted>
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} {address.postalCode}
                  </Muted>
                  <Muted>{address.phone}</Muted>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setUseNew(true)}
              accessibilityRole="button"
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ fontSize: 13, textDecorationLine: "underline" }}>Use a new address</Text>
            </Pressable>
          </View>
        ) : null}

        {showNewForm ? (
          <View style={{ marginTop: spacing.md }}>
            {field("fullName", "Full name", { autoComplete: "name" })}
            {field("phone", "Phone", { keyboardType: "phone-pad", autoComplete: "tel" })}
            {field("postalCode", "PIN code", { keyboardType: "number-pad", maxLength: 6 })}
            {field("line1", "Address line 1", { autoComplete: "street-address" })}
            {field("line2", "Address line 2 (optional)")}
            {field("city", "City")}
            {field("state", "State")}
          </View>
        ) : null}

        <Field label="Coupon code (optional)" value={coupon} onChangeText={(value) => setCoupon(value.toUpperCase())} autoCapitalize="characters" />
        <Field label="Gift note (optional)" value={notes} onChangeText={setNotes} multiline />

        <Divider />

        <Eyebrow>Summary</Eyebrow>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
          <Muted>Subtotal</Muted>
          <Text>{money(cart.totals.subtotal)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Muted>Shipping</Muted>
          <Text>{cart.totals.shippingFee === 0 ? "Free" : money(cart.totals.shippingFee)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
          <Text style={typeScale.title}>Total</Text>
          <Text style={typeScale.title}>{money(cart.totals.total)}</Text>
        </View>
        <Muted>Final totals, including any coupon, are confirmed on the server.</Muted>

        {error ? <ErrorNotice message={error} /> : null}
        {pending ? <Muted>Order {pending.order.number} created. Complete payment to confirm it.</Muted> : null}

        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={busy ? "Starting secure payment…" : `Pay ${money(cart.totals.total)}`}
            onPress={placeOrder}
            busy={busy}
          />
        </View>
        <Muted style={{ marginTop: spacing.sm, textAlign: "center" }}>
          UPI, cards and netbanking via Razorpay. No card details are stored by us.
        </Muted>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
