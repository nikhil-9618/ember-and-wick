import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { api, errorText } from "@/api/client";
import type { Address } from "@/api/types";
import { Button, Divider, ErrorNotice, Eyebrow, Field, Loading, Muted } from "@/components/ui";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/auth/auth-context";
import { colors, spacing, type as typeScale } from "@/theme";

const EMPTY = { fullName: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "" };

export default function AddressesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [draft, setDraft] = useState({ ...EMPTY });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = useAsync(async () => api<{ addresses: Address[] }>("/api/v1/addresses"), [user?.id], {
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <View style={{ flex: 1, padding: spacing.lg, backgroundColor: colors.ivory }}>
        <Text style={typeScale.title}>Sign in to manage addresses</Text>
        <View style={{ marginTop: spacing.lg }}>
          <Button label="Sign in" onPress={() => router.push("/login")} />
        </View>
      </View>
    );
  }

  if (state.loading) return <Loading label="Loading addresses" />;
  if (state.error) return <ErrorNotice message={state.error} onRetry={state.refresh} />;

  async function addAddress() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/addresses", {
        method: "POST",
        body: { ...draft, line2: draft.line2 || undefined, country: "IN" },
      });
      setDraft({ ...EMPTY });
      setAdding(false);
      state.refresh();
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    Alert.alert("Delete this address?", undefined, [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/v1/addresses/${id}`, { method: "DELETE" });
            state.refresh();
          } catch (issue) {
            setError(errorText(issue));
          }
        },
      },
    ]);
  }

  const addresses = state.data?.addresses ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.ivory }} contentContainerStyle={{ padding: spacing.lg }}>
        {addresses.length === 0 ? <Muted>No saved addresses yet.</Muted> : null}

        {addresses.map((address) => (
          <View key={address.id} style={{ borderWidth: 1, borderColor: colors.line, padding: spacing.md, marginBottom: spacing.sm }}>
            <Text style={typeScale.body}>
              {address.fullName}
              {address.isDefault ? "  · default" : ""}
            </Text>
            <Muted>
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} {address.postalCode}
            </Muted>
            <Muted>{address.phone}</Muted>
            <Pressable onPress={() => remove(address.id)} accessibilityLabel={`Delete address for ${address.fullName}`} style={{ marginTop: spacing.sm, minHeight: 32, justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: colors.clayDark, textDecorationLine: "underline" }}>Delete</Text>
            </Pressable>
          </View>
        ))}

        <Divider />

        {adding ? (
          <View>
            <Eyebrow>New address</Eyebrow>
            <View style={{ marginTop: spacing.sm }}>
              <Field label="Full name" value={draft.fullName} onChangeText={(fullName) => setDraft({ ...draft, fullName })} />
              <Field label="Phone" value={draft.phone} onChangeText={(phone) => setDraft({ ...draft, phone })} keyboardType="phone-pad" />
              <Field label="PIN code" value={draft.postalCode} onChangeText={(postalCode) => setDraft({ ...draft, postalCode })} keyboardType="number-pad" maxLength={6} />
              <Field label="Address line 1" value={draft.line1} onChangeText={(line1) => setDraft({ ...draft, line1 })} />
              <Field label="Address line 2 (optional)" value={draft.line2} onChangeText={(line2) => setDraft({ ...draft, line2 })} />
              <Field label="City" value={draft.city} onChangeText={(city) => setDraft({ ...draft, city })} />
              <Field label="State" value={draft.state} onChangeText={(state) => setDraft({ ...draft, state })} />
            </View>
            {error ? <ErrorNotice message={error} /> : null}
            <Button label={busy ? "Saving…" : "Save address"} onPress={addAddress} busy={busy} />
            <View style={{ marginTop: spacing.sm }}>
              <Button label="Cancel" variant="outline" onPress={() => setAdding(false)} />
            </View>
          </View>
        ) : (
          <Button label="Add address" onPress={() => setAdding(true)} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
