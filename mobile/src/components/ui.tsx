import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, type as typeScale } from "@/theme";

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={typeScale.eyebrow}>{children}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={typeScale.display}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[typeScale.body, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[typeScale.small, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  busy,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "quiet" | "danger";
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
}) {
  const isDisabled = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(busy) }}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "outline" && styles.buttonOutline,
        variant === "quiet" && styles.buttonQuiet,
        variant === "danger" && styles.buttonDanger,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.ivory : colors.ink} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            (variant === "primary" || variant === "danger") && styles.buttonLabelLight,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.inkSoft}
        style={[styles.input, error ? styles.inputError : null]}
        accessibilityLabel={label}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "sage" | "clay" }) {
  return (
    <View
      style={[
        styles.badge,
        tone === "sage" && { backgroundColor: colors.sage },
        tone === "clay" && { backgroundColor: colors.clay },
      ]}
    >
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={typeScale.title}>{title}</Text>
      <Text style={[typeScale.small, { marginTop: spacing.sm, textAlign: "center" }]}>{body}</Text>
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.clay} />
      <Text style={[typeScale.small, { marginTop: spacing.sm }]}>{label}…</Text>
    </View>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBox} accessibilityRole="alert">
      <Text style={[typeScale.body, { color: colors.danger }]}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" style={{ marginTop: spacing.sm }}>
          <Text style={styles.retry}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginVertical: spacing.md }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  buttonPrimary: { backgroundColor: colors.ink },
  buttonOutline: { borderWidth: 1, borderColor: colors.line },
  buttonQuiet: { backgroundColor: "transparent" },
  buttonDanger: { backgroundColor: colors.danger },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.45 },
  buttonLabel: { fontSize: 14, color: colors.ink, fontWeight: "500" },
  buttonLabelLight: { color: colors.ivory },
  label: { fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: colors.inkSoft, marginBottom: 6 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.ink,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  badge: { backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  badgeLabel: { color: colors.ivory, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
  empty: { padding: spacing.xl, alignItems: "center" },
  loading: { paddingVertical: spacing.xxl, alignItems: "center" },
  errorBox: { borderWidth: 1, borderColor: colors.danger, padding: spacing.md, margin: spacing.md },
  retry: { color: colors.clay, textDecorationLine: "underline", fontSize: 13 },
});
