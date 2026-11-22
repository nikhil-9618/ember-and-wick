import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "@/api/client";
import type { Category, ProductListResponse } from "@/api/types";
import { ProductCard } from "@/components/product-card";
import { ErrorNotice, Loading, Muted } from "@/components/ui";
import { useAsync } from "@/hooks/use-async";
import { colors, spacing } from "@/theme";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "rating", label: "Top rated" },
] as const;

export default function ShopScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [category, setCategory] = useState<string | undefined>(params.category);
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("featured");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [extra, setExtra] = useState<ProductListResponse["items"]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const categoriesState = useAsync(async () => api<{ categories: Category[] }>("/api/v1/categories"), []);

  const state = useAsync(
    async () => {
      const search = new URLSearchParams({ sort, page: String(page), perPage: "12" });
      if (category) search.set("category", category);
      if (appliedQuery) search.set("q", appliedQuery);
      return api<ProductListResponse>(`/api/v1/products?${search.toString()}`);
    },
    [category, sort, appliedQuery, page],
  );

  async function loadMore() {
    if (!state.data || state.data.page >= state.data.pages || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = new URLSearchParams({ sort, page: String(page + 1), perPage: "12" });
      if (category) next.set("category", category);
      if (appliedQuery) next.set("q", appliedQuery);
      const result = await api<ProductListResponse>(`/api/v1/products?${next.toString()}`);
      setExtra((current) => [...current, ...result.items]);
      setPage(page + 1);
    } finally {
      setLoadingMore(false);
    }
  }

  const items = [...(state.data?.items ?? []), ...extra];

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory }}>
      <View style={styles.controls}>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => {
              setExtra([]);
              setPage(1);
              setAppliedQuery(query.trim());
            }}
            placeholder="Search cedar, lavender…"
            placeholderTextColor={colors.inkSoft}
            returnKeyType="search"
            accessibilityLabel="Search candles"
            style={styles.searchInput}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setExtra([]);
              setPage(1);
              setAppliedQuery(query.trim());
            }}
            style={styles.searchButton}
          >
            <Text style={styles.searchButtonLabel}>Go</Text>
          </Pressable>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ slug: undefined, name: "All" }, ...(categoriesState.data?.categories ?? [])]}
          keyExtractor={(item) => item.slug ?? "all"}
          contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}
          renderItem={({ item }) => {
            const active = (item.slug ?? undefined) === category;
            return (
              <Pressable
                onPress={() => {
                  setExtra([]);
                  setPage(1);
                  setCategory(item.slug ?? undefined);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{item.name}</Text>
              </Pressable>
            );
          }}
        />

        <View style={styles.sortRow}>
          {SORTS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                setExtra([]);
                setPage(1);
                setSort(option.value);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: sort === option.value }}
              style={styles.sortButton}
            >
              <Text style={[styles.sortLabel, sort === option.value && styles.sortLabelActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {state.loading ? (
        <Loading label="Loading candles" />
      ) : state.error ? (
        <ErrorNotice message={state.error} onRetry={state.refresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: "space-between" }}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={state.refreshing}
              onRefresh={() => {
                setExtra([]);
                setPage(1);
                state.refresh();
              }}
              tintColor={colors.clay}
            />
          }
          renderItem={({ item }) => <ProductCard product={item} width="48%" />}
          ListHeaderComponent={
            <Muted style={{ marginBottom: spacing.md }}>
              {state.data?.total ?? 0} candle{(state.data?.total ?? 0) === 1 ? "" : "s"}
              {appliedQuery ? ` for “${appliedQuery}”` : ""}
            </Muted>
          }
          ListEmptyComponent={<Muted>No candles match that search.</Muted>}
          ListFooterComponent={
            state.data && state.data.page < state.data.pages ? (
              <Pressable onPress={loadMore} style={styles.loadMore} accessibilityRole="button">
                {loadingMore ? <ActivityIndicator color={colors.clay} /> : <Text style={styles.loadMoreLabel}>Load more</Text>}
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  searchRow: { flexDirection: "row", gap: spacing.sm },
  searchInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    color: colors.ink,
  },
  searchButton: { minHeight: 46, paddingHorizontal: spacing.md, justifyContent: "center", borderWidth: 1, borderColor: colors.ink },
  searchButtonLabel: { fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  chip: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, minHeight: 36, justifyContent: "center" },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipLabel: { fontSize: 13, color: colors.ink },
  chipLabelActive: { color: colors.ivory },
  sortRow: { flexDirection: "row", gap: spacing.md, paddingBottom: spacing.sm },
  sortButton: { paddingVertical: spacing.sm, minHeight: 36, justifyContent: "center" },
  sortLabel: { fontSize: 12, color: colors.inkSoft },
  sortLabelActive: { color: colors.ink, textDecorationLine: "underline" },
  loadMore: { minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  loadMoreLabel: { fontSize: 13, textTransform: "uppercase", letterSpacing: 1 },
});
