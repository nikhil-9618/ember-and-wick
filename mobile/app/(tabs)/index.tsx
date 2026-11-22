import { useEffect } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import type { Category, ProductListResponse } from "@/api/types";
import { absoluteImage, ProductCard } from "@/components/product-card";
import { ErrorNotice, Eyebrow, Loading, Muted, Title } from "@/components/ui";
import { useAsync } from "@/hooks/use-async";
import { colors, spacing, type as typeScale } from "@/theme";
import { Pressable } from "react-native";

export default function HomeScreen() {
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem("emberwick.onboarded")
      .then((value) => {
        if (!value) router.replace("/onboarding");
      })
      .catch(() => {
        // Onboarding state is cosmetic; never block the home screen on it.
      });
  }, [router]);

  const state = useAsync(
    async (signal) => {
      const [featured, categories] = await Promise.all([
        api<ProductListResponse>("/api/v1/products?sort=featured&perPage=4"),
        api<{ categories: Category[] }>("/api/v1/categories"),
      ]);
      void signal;
      return { featured: featured.items, categories: categories.categories };
    },
    [],
  );

  if (state.loading) return <Loading label="Opening the studio" />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ivory }}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.clay} />}
    >
      <View style={styles.hero}>
        <Image
          source={{ uri: absoluteImage("/images/atelier.jpg") }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityLabel="The Ember & Wick studio"
        />
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Text style={styles.heroEyebrow}>Small-batch · Bengaluru</Text>
          <Text style={styles.heroTitle}>Candles that behave like furniture.</Text>
          <Pressable
            onPress={() => router.push("/(tabs)/shop")}
            accessibilityRole="button"
            style={styles.heroButton}
          >
            <Text style={styles.heroButtonLabel}>Shop the collection</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        {state.error ? <ErrorNotice message={state.error} onRetry={state.refresh} /> : null}

        <Eyebrow>The signature pours</Eyebrow>
        <Title>Made to be lived with</Title>
        <View style={styles.grid}>
          {state.data?.featured.map((product) => (
            <ProductCard key={product.id} product={product} width="48%" />
          ))}
        </View>

        <Eyebrow>Browse by mood</Eyebrow>
        <View style={{ marginTop: spacing.sm }}>
          {state.data?.categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => router.push({ pathname: "/(tabs)/shop", params: { category: category.slug } })}
              accessibilityRole="button"
              accessibilityLabel={`${category.name}, ${category.productCount} candles`}
              style={styles.categoryRow}
            >
              <Text style={typeScale.body}>{category.name}</Text>
              <Text style={typeScale.small}>{category.productCount} →</Text>
            </Pressable>
          ))}
        </View>

        <Muted style={{ marginTop: spacing.lg }}>
          Hand-poured in Bengaluru. Dispatch in 1-2 business days, free shipping over ₹1,499.
        </Muted>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 360, justifyContent: "flex-end" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(27,25,23,0.42)" },
  heroContent: { padding: spacing.lg },
  heroEyebrow: { color: colors.ivory, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
  heroTitle: { color: colors.ivory, fontSize: 32, lineHeight: 36, marginTop: spacing.sm },
  heroButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.ivory,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    justifyContent: "center",
  },
  heroButtonLabel: { color: colors.ink, fontSize: 13 },
  section: { padding: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: spacing.md },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    minHeight: 48,
  },
});
