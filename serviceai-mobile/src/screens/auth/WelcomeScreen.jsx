import React, { useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable,
  Animated, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, RADIUS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────────────────────
//  Pulsing live-system dot  ·  communicates "AI is running"
// ─────────────────────────────────────────────────────────────────────────────
function PulseDot({ color = COLORS.success }) {
  const ring    = useRef(new Animated.Value(1)).current;
  const ringOp  = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring,   { toValue: 2.6, duration: 1100, useNativeDriver: true }),
          Animated.timing(ring,   { toValue: 1,   duration: 0,    useNativeDriver: true }),
          Animated.delay(700),
        ]),
        Animated.sequence([
          Animated.timing(ringOp, { toValue: 0,    duration: 1100, useNativeDriver: true }),
          Animated.timing(ringOp, { toValue: 0.85, duration: 0,    useNativeDriver: true }),
          Animated.delay(700),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={{ width: 8, height: 8, alignItems: "center", justifyContent: "center" }}>
      {/* Expanding ring */}
      <Animated.View style={{
        position: "absolute",
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: color,
        transform: [{ scale: ring }],
        opacity: ringOp,
      }} />
      {/* Solid core */}
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Feature pill  ·  replaces stacked rows with compact horizontal chips
// ─────────────────────────────────────────────────────────────────────────────
function FeaturePill({ icon, text, delay }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, delay,
      friction: 8, tension: 55,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.pill, {
      opacity: anim,
      transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
    }]}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={styles.pillText}>{text}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Role Card  ·  premium depth via inner bloom + colored shadow + press states
// ─────────────────────────────────────────────────────────────────────────────
function RoleCard({
  emoji, title, subtitle, metric,
  gradient, accent, isPrimary,
  onPress, delay,
}) {
  const mount      = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const pressGlow  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(mount, {
      toValue: 1, delay,
      friction: 7, tension: 48,
      useNativeDriver: true,
    }).start();
  }, []);

  const onPressIn = () => Animated.parallel([
    Animated.spring(pressScale, { toValue: 0.962, useNativeDriver: true, speed: 55 }),
    Animated.timing(pressGlow,  { toValue: 1,     duration: 100, useNativeDriver: true }),
  ]).start();

  const onPressOut = () => Animated.parallel([
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }),
    Animated.timing(pressGlow,  { toValue: 0, duration: 280, useNativeDriver: true }),
  ]).start();

  return (
    <Animated.View style={[styles.cardShell, {
      flex: 1,
      opacity: mount,
      transform: [
        { translateY: mount.interpolate({ inputRange: [0, 1], outputRange: [54, 0] }) },
        { scale: pressScale },
      ],
      // Colored elevation glow — the card *glows* its own brand colour
      shadowColor:   accent,
      shadowOffset:  { width: 0, height: 8 },
      shadowOpacity: 0.28,
      shadowRadius:  18,
      elevation:     10,
    }]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={{ flex: 1 }}>
        <View style={[styles.card, { borderColor: accent + "44" }]}>

          {/* ── Body gradient ──────────────────────── */}
          <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />

          {/* ── Top bloom: inner light source ──────── */}
          <LinearGradient
            colors={[accent + "26", accent + "00"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.cardBloom}
          />

          {/* ── Press-glow overlay ──────────────────── */}
          <Animated.View style={[
            StyleSheet.absoluteFill,
            { borderRadius: RADIUS.xl, backgroundColor: accent + "10", opacity: pressGlow },
          ]} />

          {/* ── Card content ────────────────────────── */}
          <View style={styles.cardBody}>

            {/* Icon row */}
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconWrap, {
                backgroundColor: accent + "1C",
                borderColor:     accent + "30",
              }]}>
                <Text style={styles.cardEmoji}>{emoji}</Text>
              </View>
              {isPrimary && (
                <View style={[styles.badge, {
                  backgroundColor: accent + "14",
                  borderColor:     accent + "38",
                }]}>
                  <View style={[styles.badgeDot, { backgroundColor: accent }]} />
                  <Text style={[styles.badgeText, { color: accent }]}>Popular</Text>
                </View>
              )}
            </View>

            {/* Title + subtitle */}
            <View style={styles.cardTextBlock}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardSub}>{subtitle}</Text>
            </View>

            {/* Divider */}
            <View style={[styles.cardDivider, { backgroundColor: accent + "22" }]} />

            {/* Metric + arrow */}
            <View style={styles.cardFooter}>
              <Text style={[styles.cardMetric, { color: accent }]}>{metric}</Text>
              <View style={[styles.arrowBtn, {
                backgroundColor: accent + "18",
                borderColor:     accent + "3A",
              }]}>
                <Ionicons name="arrow-forward" size={11} color={accent} />
              </View>
            </View>

          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function WelcomeScreen({ navigation }) {
  // Entrance
  const logoIn  = useRef(new Animated.Value(0)).current;
  const heroIn  = useRef(new Animated.Value(0)).current;

  // Ambient blob opacity — slow breathe
  const blob1   = useRef(new Animated.Value(0.55)).current;
  const blob2   = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    // Staggered entrance
    Animated.stagger(100, [
      Animated.timing(logoIn, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(heroIn, { toValue: 1, duration: 580, useNativeDriver: true }),
    ]).start();

    // Slow breathing glows — never distracting, always alive
    Animated.loop(Animated.sequence([
      Animated.timing(blob1, { toValue: 1,    duration: 4000, useNativeDriver: true }),
      Animated.timing(blob1, { toValue: 0.55, duration: 4000, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.delay(2000),
      Animated.timing(blob2, { toValue: 0.8,  duration: 3400, useNativeDriver: true }),
      Animated.timing(blob2, { toValue: 0.35, duration: 3400, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>

        {/* ── Ambient background glows ──────────────────────────────────────── */}
        {/* Indigo bloom — top-left corner */}
        <Animated.View
          pointerEvents="none"
          style={[styles.blob, styles.blobIndigo, { opacity: blob1 }]}
        />
        {/* Amber bloom — bottom-right corner */}
        <Animated.View
          pointerEvents="none"
          style={[styles.blob, styles.blobAmber, { opacity: blob2 }]}
        />

        {/* ── Logo bar ──────────────────────────────────────────────────────── */}
        <Animated.View style={[styles.logoBar, {
          opacity: logoIn,
          transform: [{ translateY: logoIn.interpolate({ inputRange: [0,1], outputRange: [-16, 0] }) }],
        }]}>
          {/* Brand mark + name */}
          <View style={styles.logoLeft}>
            <LinearGradient colors={["#6C63FF", "#8B5CF6"]} style={styles.logoMark}>
              <Text style={styles.logoGlyph}>✦</Text>
            </LinearGradient>
            <Text style={styles.logoName}>ServiceAI</Text>
          </View>

          {/* Live status pill */}
          <View style={styles.livePill}>
            <PulseDot color={COLORS.success} />
            <Text style={styles.livePillText}>AI Online</Text>
          </View>
        </Animated.View>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <Animated.View style={[styles.hero, {
          opacity: heroIn,
          transform: [{ translateY: heroIn.interpolate({ inputRange: [0,1], outputRange: [22, 0] }) }],
        }]}>
          {/* Eyebrow — flanked by thin lines for editorial weight */}
          <View style={styles.eyebrowRow}>
            <View style={styles.eyeLine} />
            <Text style={styles.eyebrow}>PAKISTAN'S FIRST AGENTIC PLATFORM</Text>
            <View style={styles.eyeLine} />
          </View>

          {/* Two-line headline — clear entry point */}
          <View style={styles.headline}>
            <Text style={styles.hlAccent} adjustsFontSizeToFit numberOfLines={1}>
              Agentic Service
            </Text>
            <Text style={styles.hlPlain} adjustsFontSizeToFit numberOfLines={1}>
              Marketplace
            </Text>
          </View>

          {/* Value-prop caption */}
          <Text style={styles.caption}>
            Describe your need in Urdu or English.
            {"\n"}AI agents find, rank & book instantly.
          </Text>
        </Animated.View>

        {/* ── Feature pills ─────────────────────────────────────────────────── */}
        <View style={styles.pillRow}>
          <FeaturePill icon="🧠" text="Urdu & English" delay={360} />
          <FeaturePill icon="📍" text="Hyperlocal"     delay={480} />
          <FeaturePill icon="⚡" text="60s Booking"    delay={600} />
        </View>

        {/* Flexible gap — pushes cards toward the lower third */}
        <View style={styles.gap} />

        {/* ── CTA Cards ─────────────────────────────────────────────────────── */}
        <View style={styles.cardsRow}>
          <RoleCard
            emoji="🙋"
            title="I Need Help"
            subtitle={"Find trusted experts\nvia AI"}
            metric="50+ experts ready"
            gradient={["#14143F", "#0B0B28"]}
            accent={COLORS.primary}
            isPrimary
            onPress={() => navigation.navigate("Login", { role: "user" })}
            delay={280}
          />
          <RoleCard
            emoji="🛠️"
            title="I Provide"
            subtitle={"Earn more,\nwork smarter"}
            metric="Join the network"
            gradient={["#1C1409", "#100C05"]}
            accent={COLORS.provider}
            isPrimary={false}
            onPress={() => navigation.navigate("Login", { role: "provider" })}
            delay={400}
          />
        </View>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerTxt}>Google Antigravity Hackathon</Text>
          <View style={styles.footerDot} />
          <Text style={styles.footerTxt}>Al Seekho Phase II</Text>
          <View style={styles.footerDot} />
          <Text style={styles.footerTxt}>2026</Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  root: {
    flex: 1,
    paddingHorizontal: 22,
    overflow: "hidden",    // clips the ambient blobs cleanly
  },

  // ── Ambient blobs ──────────────────────────────────────────────────────────
  blob: {
    position: "absolute",
    borderRadius: 999,
  },
  blobIndigo: {
    // Large indigo bloom — top-left quarter
    width: 340,
    height: 340,
    backgroundColor: "rgba(108, 99, 255, 0.11)",
    top:  -140,
    left: -120,
  },
  blobAmber: {
    // Smaller amber bloom — bottom-right
    width: 220,
    height: 220,
    backgroundColor: "rgba(245, 158, 11, 0.09)",
    bottom: 20,
    right:  -80,
  },

  // ── Logo bar ───────────────────────────────────────────────────────────────
  logoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    marginBottom: 30,
  },
  logoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    // Subtle shadow so it lifts off the bg
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  logoGlyph: { fontSize: 15, color: "#fff", ...FONTS.bold },
  logoName: {
    fontSize: 18,
    ...FONTS.bold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 217, 160, 0.07)",
    borderRadius: RADIUS.full,
    paddingHorizontal: 11,
    paddingVertical:   6,
    borderWidth: 1,
    borderColor: "rgba(16, 217, 160, 0.18)",
  },
  livePillText: {
    fontSize: 11,
    color: COLORS.success,
    ...FONTS.semiBold,
  },

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero: {
    marginBottom: 20,
  },

  // Eyebrow — thin flanking lines create editorial separation
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  eyeLine: {
    height: 1,
    flex: 1,
    maxWidth: 26,
    backgroundColor: COLORS.borderLight,
  },
  eyebrow: {
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1.6,
    ...FONTS.semiBold,
  },

  // Headline — massive type contrast drives visual gravity
  headline: {
    marginBottom: 14,
  },
  hlAccent: {
    fontSize: 40,
    ...FONTS.extraBold,
    color: COLORS.primaryLight,   // #8B85FF — cool indigo, not harsh
    letterSpacing: -1.0,
    lineHeight: 48,
  },
  hlPlain: {
    fontSize: 40,
    ...FONTS.extraBold,
    color: COLORS.text,           // pure white contrast
    letterSpacing: -1.0,
    lineHeight: 48,
  },

  // Caption — the "so what" sentence
  caption: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    lineHeight: 21,
    ...FONTS.regular,
  },

  // ── Feature pills ──────────────────────────────────────────────────────────
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillIcon: { fontSize: 12 },
  pillText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    ...FONTS.medium,
  },

  // ── Layout gap ─────────────────────────────────────────────────────────────
  gap: { flex: 1, minHeight: 16 },

  // ── Cards row ──────────────────────────────────────────────────────────────
  cardsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
    minHeight: 204,
  },

  // Shell carries the colored drop-shadow (needs to be OUTSIDE overflow:hidden)
  cardShell: {
    borderRadius: RADIUS.xl,
  },
  // Inner card clips all the absolute-positioned layers cleanly
  card: {
    flex: 1,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  // Top bloom — gradient from accent colour to transparent, simulates inner light
  cardBloom: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 100,
  },
  // Content container
  cardBody: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },

  // Icon + badge row
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardEmoji: { fontSize: 22 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badgeText: {
    fontSize: 9,
    ...FONTS.bold,
    letterSpacing: 0.4,
  },

  // Text block
  cardTextBlock: {
    marginTop: 12,
    gap: 4,
  },
  cardTitle: {
    fontSize: 17,
    ...FONTS.bold,
    color: COLORS.text,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },

  // Divider above footer
  cardDivider: {
    height: 1,
    marginTop: 12,
  },

  // Metric + arrow
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cardMetric: {
    fontSize: 11,
    ...FONTS.semiBold,
  },
  arrowBtn: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 8,
  },
  footerTxt: {
    fontSize: 10,
    color: COLORS.textMuted,
    ...FONTS.medium,
    letterSpacing: 0.2,
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.textMuted + "50",
  },
});
