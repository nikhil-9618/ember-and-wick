import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/api/client";
import type { ProductListResponse } from "@/api/types";
import { ProductCard } from "@/components/product-card";
import { ErrorNotice, Muted } from "@/components/ui";
import { colors, spacing, type as typeScale } from "@/theme";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductListResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(text: string) {
    const term = text.trim();
    if (!term) {
      setResults(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResults(await api<ProductListResponse>(`/api/v1/products?q=${encodeURIComponent(term)}&perPage=24`));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory }}>
      <View style={{ padding: spacing.lg }}>
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (text.trim().length === 0) setResults(null);
          }}
          onSubmitEditing={() => void run(query)}
          placeholder="Cedar, lavender, beeswax…"
          placeholderTextColor={colors.inkSoft}
          returnKeyType="search"
          accessibilityLabel="Search candles"
          autoFocus
          style={styles.input}
        />
        {busy ? <ActivityIndicator color={colors.clay} style={{ marginTop: spacing.md }} /> : null}
        {error ? <ErrorNotice message={error} onRetry={() => void run(query)} /> : null}
        {results ? <Muted style={{ marginTop: spacing.sm }}>{results.total} results for “{query.trim()}”</Muted> : null}
        {!results && !busy ? <Muted style={{ marginTop: spacing.sm }}>Try “cedar”, “lavender” or “gifting”.</Muted> : null}
      </View>

      <FlatList
        data={results?.items ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        renderItem={({ item }) => <ProductCard product={item} width="48%" />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={results ? <Text style={typeScale.small}>No candles match that search.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.ink,
  },
});
