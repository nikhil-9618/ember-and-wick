import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, errorText, money } from "@/api/client";
import type { ProductDetail, Review } from "@/api/types";
import { absoluteImage } from "@/components/product-card";
import { Button, Divider, ErrorNotice, Eyebrow, Loading, Muted } from "@/components/ui";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/auth/auth-context";
import { colors, spacing, type as typeScale } from "@/theme";

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const state = useAsync(async () => {
    const [detail, reviews] = await Promise.all([
      api<{ product: ProductDetail }>(`/api/v1/products/${encodeURIComponent(String(slug))}`),
      api<{ reviews: Review[] }>(`/api/v1/products/${encodeURIComponent(String(slug))}/reviews`),
    ]);
    return { product: detail.product, reviews: reviews.reviews };
  }, [slug]);

  const product = state.data?.product;
  const variant = useMemo(
    () => product?.variants.find((item) => item.id === variantId) ?? product?.variants[0],
    [product, variantId],
  );

  if (state.loading) return <Loading label="Loading candle" />;
  if (state.error) return <ErrorNotice message={state.error} onRetry={state.refresh} />;
  if (!product || !variant) return <ErrorNotice message="This candle is no longer available." />;

  const soldOut = variant.stock === 0;

  async function addToCart() {
    if (!user) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/api/v1/cart", { method: "POST", body: { variantId: variant!.id, quantity } });
      setMessage("Added to your cart.");
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }

  async function toggleWishlist() {
    if (!user) {
      router.push("/login");
      return;
    }
    setError(null);
    try {
      if (saved) {
        await api(`/api/v1/wishlist?productId=${encodeURIComponent(product!.id)}`, { method: "DELETE" });
      } else {
        await api("/api/v1/wishlist", { method: "POST", body: { productId: product!.id } });
      }
      setSaved(!saved);
    } catch (issue) {
      setError(errorText(issue));
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ivory }}>
      <Image
        source={{ uri: absoluteImage(product.images[0]?.url ?? "") }}
        style={styles.hero}
        contentFit="cover"
        transition={150}
        accessibilityLabel={product.images[0]?.alt ?? product.name}
      />

      <View style={styles.body}>
        <Eyebrow>{product.categoryName ?? "Candles"}</Eyebrow>
        <Text style={typeScale.display}>{product.name}</Text>
        {product.tagline ? <Muted style={{ marginTop: spacing.xs }}>{product.tagline}</Muted> : null}

        <View style={styles.priceRow}>
          <Text style={styles.price}>{money(variant.price)}</Text>
          {product.compareAtPrice && product.compareAtPrice > variant.price ? (
            <Text style={styles.compare}>{money(product.compareAtPrice)}</Text>
          ) : null}
          <Muted>incl. GST</Muted>
        </View>

        <Eyebrow>Size</Eyebrow>
        <View style={styles.variants}>
          {product.variants.map((item) => {
            const selected = item.id === variant.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setVariantId(item.id);
                  setQuantity(1);
                }}
                disabled={item.stock === 0}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: item.stock === 0 }}
                style={[
                  styles.variant,
                  selected && styles.variantActive,
                  item.stock === 0 && styles.variantDisabled,
                ]}
              >
                <Text style={[styles.variantLabel, selected && styles.variantLabelActive]}>{item.name}</Text>
                <Text style={[styles.variantPrice, selected && styles.variantLabelActive]}>{money(item.price)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.qtyRow}>
          <Eyebrow>Quantity</Eyebrow>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
              accessibilityLabel="Decrease quantity"
              style={styles.stepperButton}
            >
              <Text style={styles.stepperLabel}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{quantity}</Text>
            <Pressable
              onPress={() => setQuantity(Math.min(10, variant.stock, quantity + 1))}
              accessibilityLabel="Increase quantity"
              style={styles.stepperButton}
            >
              <Text style={styles.stepperLabel}>+</Text>
            </Pressable>
          </View>
          <Muted>{soldOut ? "Sold out" : variant.stock <= 5 ? `Only ${variant.stock} left` : "In stock"}</Muted>
        </View>

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Button
            label={soldOut ? "Sold out" : busy ? "Adding…" : "Add to cart"}
            onPress={addToCart}
            disabled={soldOut}
            busy={busy}
          />
          <Button label={saved ? "♥ Saved" : "♡ Save for later"} onPress={toggleWishlist} variant="outline" />
        </View>

        {message ? <Text style={[typeScale.body, { color: colors.sage, marginTop: spacing.sm }]}>{message}</Text> : null}
        {error ? <ErrorNotice message={error} /> : null}

        <Divider />

        <Eyebrow>About this candle</Eyebrow>
        {product.description.split("\n\n").map((paragraph, index) => (
          <Text key={index} style={[typeScale.body, { marginTop: spacing.sm }]}>
            {paragraph}
          </Text>
        ))}

        <Divider />

        <View style={styles.specs}>
          {product.waxType ? <Spec label="Wax" value={product.waxType} /> : null}
          {product.wickType ? <Spec label="Wick" value={product.wickType} /> : null}
          {product.burnTimeHours ? <Spec label="Burn time" value={`${product.burnTimeHours} hours`} /> : null}
          {product.scentNotes ? <Spec label="Scent" value={product.scentNotes} /> : null}
        </View>

        <Divider />

        <Eyebrow>Customer notes</Eyebrow>
        {state.data?.reviews.length === 0 ? (
          <Muted style={{ marginTop: spacing.sm }}>No reviews yet.</Muted>
        ) : (
          state.data?.reviews.map((review) => (
            <View key={review.id} style={{ marginTop: spacing.md }}>
              <Text style={{ color: colors.clay }}>{"★".repeat(review.rating)}</Text>
              {review.title ? <Text style={{ marginTop: 2 }}>{review.title}</Text> : null}
              <Muted style={{ marginTop: 2 }}>{review.body}</Muted>
              <Muted>
                {review.author} · {new Date(review.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </Muted>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: "48%", marginBottom: spacing.md }}>
      <Text style={typeScale.eyebrow}>{label}</Text>
      <Text style={[typeScale.small, { marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.sand },
  body: { padding: spacing.lg },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginVertical: spacing.md },
  price: { fontSize: 24, color: colors.ink },
  compare: { fontSize: 14, color: colors.inkSoft, textDecorationLine: "line-through" },
  variants: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  variant: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 48, justifyContent: "center" },
  variantActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  variantDisabled: { opacity: 0.4 },
  variantLabel: { fontSize: 13, color: colors.ink },
  variantLabelActive: { color: colors.ivory },
  variantPrice: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.lg },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line },
  stepperButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stepperLabel: { fontSize: 18 },
  stepperValue: { minWidth: 28, textAlign: "center" },
  specs: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
});
