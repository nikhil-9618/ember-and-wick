import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api, errorText, money } from "@/api/client";
import type { WishlistItem } from "@/api/types";
import { absoluteImage } from "@/components/product-card";
import { Button, EmptyState, ErrorNotice, Loading, Muted } from "@/components/ui";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/auth/auth-context";
import { useState } from "react";
import { colors, spacing, type as typeScale } from "@/theme";

export default function WishlistScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const state = useAsync(async () => api<{ items: WishlistItem[] }>("/api/v1/wishlist"), [user?.id], {
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <EmptyState
        title="Sign in to save candles"
        body="Your wishlist syncs between the app and the website."
        action={<Button label="Sign in" onPress={() => router.push("/login")} />}
      />
    );
  }

  if (state.loading) return <Loading label="Loading wishlist" />;
  if (state.error) return <ErrorNotice message={state.error} onRetry={state.refresh} />;

  const items = state.data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing saved yet"
        body="Tap Save on any candle to keep it here."
        action={<Button label="Browse candles" onPress={() => router.push("/(tabs)/shop")} />}
      />
    );
  }

  async function remove(productId: string) {
    setError(null);
    try {
      await api(`/api/v1/wishlist?productId=${encodeURIComponent(productId)}`, { method: "DELETE" });
      state.refresh();
    } catch (issue) {
      setError(errorText(issue));
    }
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.ivory }}
      contentContainerStyle={{ padding: spacing.lg }}
      data={items}
      keyExtractor={(item) => item.productId}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.clay} />}
      ListHeaderComponent={error ? <ErrorNotice message={error} /> : null}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Pressable onPress={() => router.push(`/product/${item.slug}`)} style={{ flexDirection: "row", flex: 1, gap: spacing.md }}>
            <Image
              source={{ uri: absoluteImage(item.imageUrl ?? "") }}
              style={styles.thumb}
              contentFit="cover"
              accessibilityLabel={item.imageAlt ?? item.name}
            />
            <View style={{ flex: 1 }}>
              <Text style={typeScale.body}>{item.name}</Text>
              <Muted>{money(item.price)}</Muted>
              <Muted>{item.inStock ? "In stock" : "Currently sold out"}</Muted>
            </View>
          </Pressable>
          <Pressable onPress={() => remove(item.productId)} accessibilityLabel={`Remove ${item.name} from wishlist`}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  thumb: { width: 76, height: 76, backgroundColor: colors.sand },
  remove: { fontSize: 12, color: colors.clayDark, textDecorationLine: "underline" },
});
