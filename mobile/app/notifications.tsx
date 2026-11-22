import { useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api, errorText } from "@/api/client";
import type { NotificationItem } from "@/api/types";
import { Button, EmptyState, ErrorNotice, Loading, Muted } from "@/components/ui";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/auth/auth-context";
import { colors, spacing, type as typeScale } from "@/theme";

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const state = useAsync(async () => api<{ items: NotificationItem[]; unread: number }>("/api/v1/notifications"), [user?.id], {
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <EmptyState
        title="Sign in for updates"
        body="Order confirmations and shipping notices appear here."
        action={<Button label="Sign in" onPress={() => router.push("/login")} />}
      />
    );
  }

  if (state.loading) return <Loading label="Loading updates" />;
  if (state.error) return <ErrorNotice message={state.error} onRetry={state.refresh} />;

  const items = state.data?.items ?? [];

  async function markAllRead() {
    setError(null);
    try {
      await api("/api/v1/notifications", { method: "POST", body: {} });
      state.refresh();
    } catch (issue) {
      setError(errorText(issue));
    }
  }

  if (items.length === 0) {
    return <EmptyState title="No updates yet" body="We'll let you know when your order ships." />;
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.ivory }}
      contentContainerStyle={{ padding: spacing.lg }}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.clay} />}
      ListHeaderComponent={
        <View>
          {error ? <ErrorNotice message={error} /> : null}
          {(state.data?.unread ?? 0) > 0 ? (
            <Pressable onPress={markAllRead} accessibilityRole="button" style={{ marginBottom: spacing.md, minHeight: 36, justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: colors.clay, textDecorationLine: "underline" }}>
                Mark all as read ({state.data?.unread})
              </Text>
            </Pressable>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.row, item.readAt ? { opacity: 0.65 } : null]}>
          <Text style={typeScale.body}>{item.title}</Text>
          <Muted style={{ marginTop: 2 }}>{item.body}</Muted>
          <Muted style={{ marginTop: 4 }}>
            {new Date(item.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
          </Muted>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
});
