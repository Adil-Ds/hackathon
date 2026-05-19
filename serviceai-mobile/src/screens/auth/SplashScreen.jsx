import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONTS, RADIUS } from "../../constants/theme";

const { width } = Dimensions.get("window");

const RING_SIZES = [180, 240, 300];

export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const ringAnims = useRef(RING_SIZES.map(() => new Animated.Value(0))).current;
  const dotAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Logo reveal
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      // Rings expand
      ringAnims.forEach((anim, i) => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          delay: i * 150,
          useNativeDriver: true,
        }).start();
      });

      // Tagline
      Animated.timing(taglineOpacity, { toValue: 1, duration: 600, delay: 400, useNativeDriver: true }).start();

      // Pulsing dots
      dotAnims.forEach((anim, i) => {
        const loop = () => {
          Animated.sequence([
            Animated.delay(i * 180),
            Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.25, duration: 350, useNativeDriver: true }),
            Animated.delay(360 - i * 180),
          ]).start(loop);
        };
        setTimeout(loop, 600);
      });
    });
  }, []);

  return (
    <LinearGradient colors={[COLORS.bg, COLORS.surface, COLORS.bg]} style={styles.container}>
      {/* Ambient rings */}
      {RING_SIZES.map((size, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: ringAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, 0.07 - i * 0.018] }),
              transform: [{ scale: ringAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            },
          ]}
        />
      ))}

      {/* Logo mark */}
      <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <LinearGradient colors={["#1A1A40", "#0D0D28"]} style={styles.iconBox}>
          <LinearGradient colors={[COLORS.primary, "#8B5CF6"]} style={styles.iconInner}>
            <Text style={styles.icon}>✦</Text>
          </LinearGradient>
        </LinearGradient>

        <Text style={styles.title}>ServiceAI</Text>
        <View style={styles.geminiPill}>
          <Text style={styles.geminiText}>Powered by Groq AI</Text>
        </View>
      </Animated.View>

      {/* Loading dots */}
      <View style={styles.dotsRow}>
        {dotAnims.map((anim, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: anim, backgroundColor: i === 1 ? COLORS.primary : COLORS.primaryLight }]} />
        ))}
      </View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Smart · Agentic · Local
      </Animated.Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 52,
  },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  iconInner: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 28,
    color: "#fff",
    ...FONTS.bold,
  },
  title: {
    fontSize: 38,
    ...FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  geminiPill: {
    backgroundColor: COLORS.primaryGlow,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.primary + "44",
  },
  geminiText: {
    fontSize: 11,
    color: COLORS.primary,
    ...FONTS.medium,
    letterSpacing: 0.3,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tagline: {
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 3,
    textTransform: "uppercase",
    ...FONTS.medium,
  },
});
