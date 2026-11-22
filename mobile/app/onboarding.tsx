import { useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { absoluteImage } from "@/components/product-card";
import { colors, spacing } from "@/theme";

export const ONBOARDING_KEY = "emberwick.onboarded";

const SLIDES = [
  {
    image: "/images/atelier.jpg",
    title: "Poured by hand",
    body: "Small batches of beeswax and soy, wooden wicks and essential oils, made in our Bengaluru studio.",
  },
  {
    image: "/images/products/cedar.jpg",
    title: "Scent that settles",
    body: "Every candle cures for seven days so the fragrance binds to the wax. No paraffin, no synthetic musk.",
  },
  {
    image: "/images/products/lavender.jpg",
    title: "Delivered with care",
    body: "Recycled kraft packaging, tracked delivery across India, and a 7-day return window on unlit candles.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index]!;
  const last = index === SLIDES.length - 1;

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    router.replace("/(tabs)");
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: absoluteImage(slide.image) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityLabel={slide.title}
      />
      <View style={styles.overlay} />
      <View style={styles.content}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>

        <View style={styles.dots} accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((_, position) => (
            <View key={position} style={[styles.dot, position === index && styles.dotActive]} />
          ))}
        </View>

        <Pressable
          onPress={() => (last ? void finish() : setIndex(index + 1))}
          accessibilityRole="button"
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>{last ? "Start shopping" : "Next"}</Text>
        </Pressable>

        {!last ? (
          <Pressable onPress={() => void finish()} accessibilityRole="button" style={styles.skip}>
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink, justifyContent: "flex-end" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(27,25,23,0.5)" },
  content: { padding: spacing.xl },
  title: { color: colors.ivory, fontSize: 32, lineHeight: 36 },
  body: { color: colors.ivory, opacity: 0.85, marginTop: spacing.md, fontSize: 15, lineHeight: 22 },
  dots: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  dot: { width: 24, height: 2, backgroundColor: "rgba(250,247,242,0.35)" },
  dotActive: { backgroundColor: colors.ivory },
  button: { marginTop: spacing.xl, backgroundColor: colors.ivory, minHeight: 50, alignItems: "center", justifyContent: "center" },
  buttonLabel: { color: colors.ink, fontSize: 14 },
  skip: { marginTop: spacing.md, minHeight: 44, alignItems: "center", justifyContent: "center" },
  skipLabel: { color: colors.ivory, opacity: 0.8, fontSize: 13 },
});
