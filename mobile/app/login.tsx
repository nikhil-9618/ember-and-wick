import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { errorText } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import type { OtpChallenge } from "@/api/types";
import { Button, ErrorNotice, Eyebrow, Field, Muted } from "@/components/ui";
import { colors, spacing, type as typeScale } from "@/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { requestOtp, verifyOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
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

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const started = await requestOtp(email.trim(), password);
      setChallenge(started);
      setCode("");
      setResendIn(30);
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
      await verifyOtp(challenge.challengeId, code);
      finish();
    } catch (issue) {
      setError(errorText(issue));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (challenge) await submitCode();
    else await sendCode();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ivory }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Eyebrow>Welcome back</Eyebrow>
        <Text style={typeScale.display}>Sign in</Text>
        <Muted style={{ marginTop: spacing.sm }}>
          {challenge
            ? `Enter the 6-digit code we sent to ${challenge.email}.`
            : "Use your password, then confirm the one-time code."}
        </Muted>

        <View style={{ marginTop: spacing.lg }}>
          {challenge ? (
            <>
              {challenge.delivery === "demo" && challenge.demoCode ? (
                <Muted>Demo store code: {challenge.demoCode}</Muted>
              ) : null}
              <Field
                label="Sign-in code"
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                accessibilityLabel="Six digit sign-in code"
              />
            </>
          ) : (
            <>
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
            </>
          )}
        </View>

        {error ? <ErrorNotice message={error} /> : null}

        <Button
          label={busy ? "Please wait…" : challenge ? "Verify and sign in" : "Send code"}
          onPress={submit}
          busy={busy}
        />
        {challenge ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Button
              label={resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              variant="outline"
              onPress={sendCode}
              busy={busy || resendIn > 0}
            />
            <Button
              label="Use a different email"
              variant="outline"
              onPress={() => {
                setChallenge(null);
                setCode("");
                setError(null);
              }}
            />
          </View>
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Button label="Create an account" variant="outline" onPress={() => router.replace("/register")} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
