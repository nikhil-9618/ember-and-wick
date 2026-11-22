import { useState } from "react";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { errorText } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { Button, ErrorNotice, Eyebrow, Field, Muted } from "@/components/ui";
import { colors, spacing, type as typeScale } from "@/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/account");
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ivory }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Eyebrow>Welcome back</Eyebrow>
        <Text style={typeScale.display}>Sign in</Text>
        <Muted style={{ marginTop: spacing.sm }}>Your cart, wishlist and orders are waiting.</Muted>

        <View style={{ marginTop: spacing.lg }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel="Email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            accessibilityLabel="Password"
          />
        </View>

        {error ? <ErrorNotice message={error} /> : null}

        <Button label={busy ? "Signing in…" : "Sign in"} onPress={submit} busy={busy} />
        <View style={{ marginTop: spacing.md }}>
          <Button label="Create an account" variant="outline" onPress={() => router.replace("/register")} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
