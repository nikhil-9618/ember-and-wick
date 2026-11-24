import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { errorText } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import type { SignupChallenge } from "@/api/types";
import { Button, ErrorNotice, Eyebrow, Field, Muted } from "@/components/ui";
import { colors, spacing, type as typeScale } from "@/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const { startSignup, verifySignup } = useAuth();
  const [values, setValues] = useState({ name: "", email: "", phone: "", password: "" });
  const [challenge, setChallenge] = useState<SignupChallenge | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function finish() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/account");
  }

  async function requestCode() {
    const started = await startSignup({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
      phone: values.phone.trim() || undefined,
    });
    setChallenge(started);
    setCode("");
    setResendIn(30);
  }

  async function submitDetails() {
    setBusy(true);
    setError(null);
    try {
      await requestCode();
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await verifySignup(challenge.challengeId, code);
      finish();
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (resendIn > 0) return;
    setBusy(true);
    setError(null);
    try {
      await requestCode();
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }

  if (challenge) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.ivory }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Eyebrow>Step 2 of 2</Eyebrow>
          <Text style={typeScale.display}>Verify your email</Text>
          <Muted style={{ marginTop: spacing.sm }}>
            We emailed a 6-digit code to {challenge.email}. Enter it to finish creating your account.
          </Muted>

          <View style={{ marginTop: spacing.lg }}>
            <Field
              label="Verification code"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={6}
              accessibilityLabel="Six digit verification code"
            />
          </View>

          {error ? <ErrorNotice message={error} /> : null}

          <Button
            label={busy ? "Verifying…" : "Verify and create account"}
            onPress={submitCode}
            busy={busy || code.length !== 6}
          />
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Button
              label={resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              variant="outline"
              onPress={resend}
              busy={busy || resendIn > 0}
            />
            <Button
              label="Change details"
              variant="outline"
              onPress={() => {
                setChallenge(null);
                setCode("");
                setError(null);
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
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
          We&apos;ll email a 6-digit code to confirm your address. Save addresses, track orders and keep a wishlist
          across your phone and laptop.
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
          <Button label={busy ? "Sending code…" : "Send verification code"} onPress={submitDetails} busy={busy} />
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Button label="I already have an account" variant="outline" onPress={() => router.replace("/login")} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
