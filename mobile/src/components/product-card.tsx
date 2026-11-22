import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { money } from "@/api/client";
import type { ProductListItem } from "@/api/types";
import { colors, spacing, type as typeScale } from "@/theme";

export function ProductCard({ product, width }: { product: ProductListItem; width?: number | `${number}%` }) {
  const router = useRouter();
  const onSale = product.compareAtPrice !== null && product.compareAtPrice > product.price;
  const soldOut = product.totalStock === 0;

  return (
    <Pressable
      onPress={() => router.push(`/product/${product.slug}`)}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${money(product.price)}${soldOut ? ", sold out" : ""}`}
      style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.imageWrap}>
        {product.imageUrl ? (
          <Image
            source={{ uri: absoluteImage(product.imageUrl) }}
            style={styles.image}
            contentFit="cover"
            transition={150}
            accessibilityLabel={product.imageAlt ?? product.name}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={typeScale.small}>Image coming soon</Text>
          </View>
        )}
        {soldOut ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Sold out</Text>
          </View>
        ) : product.totalStock <= 6 ? (
          <View style={[styles.badge, { backgroundColor: colors.clay }]}>
            <Text style={styles.badgeText}>Only {product.totalStock} left</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.category}>{product.categoryName ?? "Candles"}</Text>
      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>
      <View style={styles.priceRow}>
        <Text style={typeScale.body}>{money(product.price)}</Text>
        {onSale ? <Text style={styles.compare}>{money(product.compareAtPrice!)}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Product image paths are site-relative; the native app needs an absolute URL. */
export function absoluteImage(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  imageWrap: { aspectRatio: 4 / 3, backgroundColor: colors.sand, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 8, left: 8, backgroundColor: colors.ink, paddingHorizontal: 6, paddingVertical: 3 },
  badgeText: { color: colors.ivory, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" },
  category: { ...typeScale.eyebrow, marginTop: spacing.sm },
  name: { fontSize: 16, color: colors.ink, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: 2 },
  compare: { fontSize: 12, color: colors.inkSoft, textDecorationLine: "line-through" },
});
