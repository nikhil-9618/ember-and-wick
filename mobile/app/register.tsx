import { useState } from "react";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { errorText } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { Button, ErrorNotice, Eyebrow, Field, Muted } from "@/components/ui";
import { colors, spacing, type as typeScale } from "@/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [values, setValues] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        phone: values.phone.trim() || undefined,
      });
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
        <Eyebrow>Join the studio</Eyebrow>
        <Text style={typeScale.display}>Create an account</Text>
        <Muted style={{ marginTop: spacing.sm }}>
          Save addresses, track orders and keep a wishlist across your phone and laptop.
        </Muted>

        <View style={{ marginTop: spacing.lg }}>
          <Field label="Full name" value={values.name} onChangeText={(name) => setValues({ ...values, name })} autoComplete="name" />
          <Field
            label="Email"
            value={values.email}
            onChangeText={(email) => setValues({ ...values, email })}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Field
            label="Phone (optional)"
            value={values.phone}
            onChangeText={(phone) => setValues({ ...values, phone })}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <Field
            label="Password"
            value={values.password}
            onChangeText={(password) => setValues({ ...values, password })}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Muted>At least 8 characters, with a letter and a number.</Muted>
        </View>

        {error ? <ErrorNotice message={error} /> : null}

        <View style={{ marginTop: spacing.md }}>
          <Button label={busy ? "Creating account…" : "Create account"} onPress={submit} busy={busy} />
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Button label="I already have an account" variant="outline" onPress={() => router.replace("/login")} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
