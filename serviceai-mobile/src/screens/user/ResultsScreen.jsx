import React, { useRef, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated, Pressable, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, RADIUS, SHADOWS } from "../../constants/theme";

// ── Groq Reasoning Card ───────────────────────────────────────────────────────
function GeminiReasoningCard({ reasoning, modelName }) {
  const [expanded, setExpanded] = useState(true);
  const [displayed, setDisplayed] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!expanded || !reasoning) return;
    setDisplayed("");
    let idx = 0;
    const iv = setInterval(() => {
      idx = Math.min(idx + 3, reasoning.length);
      setDisplayed(reasoning.slice(0, idx));
      if (idx >= reasoning.length) clearInterval(iv);
    }, 16);
    return () => clearInterval(iv);
  }, [expanded, reasoning]);

  if (!reasoning) return null;

  return (
    <Animated.View style={[styles.reasoningCard, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={["rgba(108,99,255,0.12)", "rgba(139,92,246,0.06)"]}
        style={styles.reasoningGradient}
      />
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.reasoningHeader}>
        <View style={styles.reasoningTitleRow}>
          <View style={styles.geminiDot} />
          <Text style={styles.reasoningTitle}>Groq Final Reasoning</Text>
          <View style={styles.modelBadge}>
            <Text style={styles.modelBadgeText}>{modelName || "llama-3.3-70b-versatile"}</Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={COLORS.textMuted}
        />
      </Pressable>
      {expanded && (
        <View style={styles.reasoningBody}>
          <Text style={styles.reasoningText}>"{displayed}"</Text>
        </View>
      )}
    </Animated.View>
  );
}

const RANK_CFG = [
  { label: "#1", gradient: ["#92701A", "#D4A017"], glow: COLORS.warning, ringColor: "#FFD700" },
  { label: "#2", gradient: ["#606060", "#A8A8A8"], glow: "#A8A8A8", ringColor: "#C0C0C0" },
  { label: "#3", gradient: ["#5C3010", "#9E6030"], glow: "#CD7F32", ringColor: "#CD7F32" },
];

// ── Animated Score Bar ────────────────────────────────────────────────────────
function ScoreBar({ label, value, color, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 700, delay, useNativeDriver: false }).start();
  }, []);

  return (
    <View style={styles.scoreBarRow}>
      <Text style={styles.scoreBarLabel}>{label}</Text>
      <View style={styles.scoreBarBg}>
        <Animated.View
          style={[
            styles.scoreBarFill,
            {
              width: anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={[styles.scoreBarVal, { color }]}>{value}</Text>
    </View>
  );
}

// ── Stat Pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon, value, sub }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={14} color={COLORS.textSecondary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

// ── Provider Card ─────────────────────────────────────────────────────────────
function ProviderCard({ item, onSelect, delay }) {
  const p = item.provider;
  const cfg = RANK_CFG[item.rank - 1] || RANK_CFG[2];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [expanded, setExpanded] = useState(item.rank === 1);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  const breakdown = item.score_breakdown || {};

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], marginBottom: 14 }}>
      <View style={[
        styles.card,
        item.rank === 1 && styles.cardGold,
      ]}>
        {/* Gold shimmer for #1 */}
        {item.rank === 1 && (
          <LinearGradient
            colors={["rgba(255,215,0,0.06)", "transparent"]}
            style={styles.cardShimmer}
          />
        )}

        {/* Header row */}
        <View style={styles.cardHeader}>
          <LinearGradient colors={cfg.gradient} style={styles.rankBadge}>
            <Text style={styles.rankText}>{cfg.label}</Text>
          </LinearGradient>

          <View style={styles.providerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.providerName}>{p.name}</Text>
              {p.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>
            <Text style={styles.providerMeta}>
              <Ionicons name="location-outline" size={11} color={COLORS.textMuted} /> {p.area}, {p.city} · {p.experience_years}yr exp
            </Text>
          </View>

          <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textMuted} />
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill icon="star" value={p.rating} sub="rating" />
          <StatPill icon="navigate-outline" value={`${item.distance_km}km`} sub="away" />
          <StatPill icon="cash-outline" value={`₨${p.price_min.toLocaleString()}`} sub="from" />
          <StatPill icon="people-outline" value={p.review_count} sub="reviews" />
        </View>

        {/* Match score */}
        <View style={styles.matchScoreRow}>
          <Text style={styles.matchScoreLabel}>Match Score</Text>
          <View style={styles.matchScoreRight}>
            <Text style={styles.matchScoreNum}>{item.score}</Text>
            <Text style={styles.matchScoreMax}>/100</Text>
          </View>
        </View>
        <View style={styles.mainScoreBg}>
          <Animated.View style={[styles.mainScoreFill, { width: `${item.score}%` }]} />
        </View>

        {/* Expanded breakdown */}
        {expanded && (
          <View style={styles.expandedSection}>
            <Text style={styles.breakdownTitle}>Score Breakdown</Text>
            <ScoreBar label="Distance" value={breakdown.distance_score || 0} color={COLORS.info} delay={100} />
            <ScoreBar label="Rating" value={breakdown.rating_score || 0} color={COLORS.success} delay={200} />
            <ScoreBar label="Price" value={breakdown.price_score || 0} color={COLORS.warning} delay={300} />
            <ScoreBar label="Reviews" value={breakdown.reviews_score || 0} color={COLORS.primary} delay={400} />

            {/* AI reasoning */}
            <View style={styles.aiReasonBox}>
              <View style={styles.aiReasonHeader}>
                <Text style={styles.aiReasonLabel}>🤖 AI Reasoning</Text>
                <View style={styles.geminiChip}>
                  <Text style={styles.geminiChipText}>Groq</Text>
                </View>
              </View>
              <Text style={styles.aiReasonText}>"{item.reason}"</Text>
            </View>
          </View>
        )}

        {/* Book CTA */}
        <TouchableOpacity onPress={() => onSelect(item)} activeOpacity={0.85}>
          <LinearGradient
            colors={item.rank === 1 ? ["#6C63FF", "#8B5CF6"] : ["#1A1A38", "#111127"]}
            style={styles.bookBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="calendar-outline" size={16} color={item.rank === 1 ? "#fff" : COLORS.primary} />
            <Text style={[styles.bookBtnText, item.rank !== 1 && { color: COLORS.primary }]}>
              {item.rank === 1 ? "Book Top Match →" : "Book This Provider →"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function formatHours(hours) {
  if (!hours) return null;
  if (typeof hours === "string") return hours.slice(0, 50);
  const entries = Object.entries(hours);
  if (entries.length === 0) return null;
  // show up to 2 days
  return entries.slice(0, 2).map(([d, h]) => `${d}: ${h}`).join("  |  ");
}

// ── Location Banner ───────────────────────────────────────────────────────────
function LocationBanner({ intent, webResults }) {
  if (!intent) return null;
  const area    = intent.area || "";
  const city    = intent.city || "";
  const locStr  = [area, city].filter(Boolean).join(", ");
  const service = (intent.service_category || "").replace(/_/g, " ");

  // pull GPS from first OSM result that has coords
  const osmHit  = (webResults || []).find(r => r.source === "openstreetmap" && r.lat);
  const coordStr = osmHit
    ? `${parseFloat(osmHit.lat).toFixed(4)}° N, ${parseFloat(osmHit.lng).toFixed(4)}° E`
    : null;

  return (
    <View style={styles.locBanner}>
      <View style={styles.locLeft}>
        <View style={styles.locIconWrap}>
          <Ionicons name="location" size={16} color="#34D399" />
        </View>
        <View>
          <Text style={styles.locLabel}>Searching near</Text>
          <Text style={styles.locCity}>{locStr || "Your location"}</Text>
          {coordStr && (
            <Text style={styles.locCoords}>{coordStr}</Text>
          )}
        </View>
      </View>
      {service ? (
        <View style={styles.serviceTag}>
          <Text style={styles.serviceTagText}>{service}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Live Scrape Result Card ───────────────────────────────────────────────────
function ScrapeResultCard({ result, index = 0, delay = 0 }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 450, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8,   delay, useNativeDriver: true }),
    ]).start();
  }, []);

  const isOSM      = result.source === "openstreetmap";
  const accent     = isOSM ? "#34D399" : COLORS.info;
  const sourceLabel= isOSM ? "OpenStreetMap" : "DuckDuckGo Web";
  const hours      = formatHours(result.hours);
  const address    = [result.address, result.city].filter(Boolean).join(", ");

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], marginBottom: 14 }}>
      <View style={[styles.scrapeCard, { borderColor: accent + "44" }]}>

        {/* ── Row 1: number + name + rating ──────────────────── */}
        <View style={styles.scRow}>
          <View style={[styles.scIndex, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
            <Text style={[styles.scIndexText, { color: accent }]}>#{index + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scName}>{result.name}</Text>
            <View style={[styles.scBadge, { backgroundColor: accent + "18", borderColor: accent + "33" }]}>
              <Ionicons name={isOSM ? "map-outline" : "globe-outline"} size={9} color={accent} />
              <Text style={[styles.scBadgeText, { color: accent }]}>{sourceLabel}</Text>
            </View>
          </View>
          {result.rating != null && (
            <View style={styles.scRating}>
              <Ionicons name="star" size={12} color={COLORS.warning} />
              <Text style={styles.scRatingNum}>{result.rating}</Text>
              {result.reviews_count != null && (
                <Text style={styles.scReviews}>{result.reviews_count} reviews</Text>
              )}
            </View>
          )}
        </View>

        {/* ── Divider ─────────────────────────────────────────── */}
        <View style={styles.scDivider} />

        {/* ── Row 2: address / description ────────────────────── */}
        {address ? (
          <View style={styles.scInfoRow}>
            <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.scInfoText}>{address}</Text>
          </View>
        ) : result.description ? (
          <View style={styles.scInfoRow}>
            <Ionicons name="document-text-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.scInfoText} numberOfLines={2}>{result.description}</Text>
          </View>
        ) : null}

        {/* ── Row 3: distance ─────────────────────────────────── */}
        {result.distance_km != null && (
          <View style={styles.scInfoRow}>
            <Ionicons name="navigate-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.scInfoText}>{result.distance_km} km from your location</Text>
          </View>
        )}

        {/* ── Row 4: hours ─────────────────────────────────────── */}
        {hours && (
          <View style={styles.scInfoRow}>
            <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.scInfoText}>{hours}</Text>
          </View>
        )}

        {/* ── Divider ─────────────────────────────────────────── */}
        <View style={[styles.scDivider, { marginBottom: 10 }]} />

        {/* ── Row 5: actions ──────────────────────────────────── */}
        <View style={styles.scActions}>
          {result.phone ? (
            <TouchableOpacity
              style={[styles.scPhoneBtn, { backgroundColor: COLORS.success }]}
              onPress={() => Linking.openURL(`tel:${result.phone.replace(/[\s\-()]/g, "")}`)}
              activeOpacity={0.85}
            >
              <Ionicons name="call" size={14} color="#fff" />
              <Text style={styles.scPhoneBtnText}>{result.phone}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.scNoContact}>
              <Ionicons name="call-outline" size={13} color={COLORS.textMuted} />
              <Text style={styles.scNoContactText}>No phone number available</Text>
            </View>
          )}
          {(result.source_url || result.website || result.url) ? (
            <TouchableOpacity
              style={[styles.scWebBtn, { borderColor: accent + "55" }]}
              onPress={() => Linking.openURL(result.source_url || result.website || result.url)}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={13} color={accent} />
              <Text style={[styles.scWebBtnText, { color: accent }]}>
                {result.source === "openstreetmap" ? "OpenStreetMap" : "View Source"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

      </View>
    </Animated.View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function ResultsScreen({ route, navigation }) {
  const { ranked, intent, geminiReasoning, modelName, webResults = [] } = route.params;
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerAnim }]}>
          <Text style={styles.title}>Live Results</Text>
          <Text style={styles.subtitle}>
            {webResults.length > 0
              ? `${webResults.length} real-time result${webResults.length !== 1 ? "s" : ""} · ${[intent?.area, intent?.city].filter(Boolean).join(", ")}`
              : `No results · ${[intent?.area, intent?.city].filter(Boolean).join(", ")}`}
          </Text>
          <View style={styles.chipRow}>
            {webResults.length > 0 ? (
              <View style={[styles.formulaChip, { borderColor: "#34D39944", backgroundColor: "#34D39911" }]}>
                <Ionicons name="wifi-outline" size={12} color="#34D399" />
                <Text style={[styles.formulaText, { color: "#34D399" }]}>Real-time · OSM + DuckDuckGo</Text>
              </View>
            ) : (
              <View style={[styles.formulaChip, { borderColor: COLORS.danger + "44", backgroundColor: COLORS.dangerGlow }]}>
                <Ionicons name="alert-circle-outline" size={12} color={COLORS.danger} />
                <Text style={[styles.formulaText, { color: COLORS.danger }]}>No live results found</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Location Banner */}
        <LocationBanner intent={intent} webResults={webResults} />

        {/* Groq Reasoning */}
        {geminiReasoning ? (
          <GeminiReasoningCard reasoning={geminiReasoning} modelName={modelName} />
        ) : null}

        {/* Live Scrape Results — real-time only */}
        {webResults.length > 0 ? (
          <>
            <View style={styles.webSectionHeader}>
              <View style={styles.liveChip}>
                <Ionicons name="wifi-outline" size={11} color="#34D399" />
                <Text style={styles.liveChipText}>LIVE</Text>
              </View>
              <Text style={styles.webSectionTitle}>
                {webResults.filter(r => r.source === "openstreetmap").length > 0
                  ? "OpenStreetMap + Web"
                  : "Web Search Results"}
              </Text>
            </View>

            {webResults.map((r, i) => (
              <ScrapeResultCard key={i} result={r} index={i} delay={i * 80} />
            ))}

            <View style={styles.webDisclaimer}>
              <Ionicons name="information-circle-outline" size={13} color={COLORS.textMuted} />
              <Text style={styles.webDisclaimerText}>
                Live data from OpenStreetMap & DuckDuckGo. Call to confirm availability.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={44} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No live results found</Text>
            <Text style={styles.emptyText}>Try rephrasing your request or searching a different area.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 48 },

  header: { marginBottom: 20 },
  title: { fontSize: 26, ...FONTS.extraBold, color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  formulaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primaryGlow,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.primary + "33",
    alignSelf: "flex-start",
  },
  formulaText: { fontSize: 11, color: COLORS.primary },

  reasoningCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primary + "44",
    overflow: "hidden",
    position: "relative",
    ...SHADOWS.md,
  },
  reasoningGradient: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },
  reasoningHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reasoningTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  geminiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  reasoningTitle: {
    fontSize: 11,
    ...FONTS.bold,
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  modelBadge: {
    backgroundColor: COLORS.primaryGlow,
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.primary + "33",
  },
  modelBadgeText: {
    fontSize: 9,
    color: COLORS.primary,
    ...FONTS.semiBold,
  },
  reasoningBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reasoningText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    fontStyle: "italic",
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.md,
    overflow: "hidden",
    position: "relative",
  },
  cardGold: {
    borderColor: COLORS.warning + "55",
    ...SHADOWS.glowProvider,
  },
  cardShimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },

  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  rankBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: "#000", fontSize: 13, ...FONTS.extraBold },
  providerInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 },
  providerName: { fontSize: 15, ...FONTS.bold, color: COLORS.text },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.successGlow,
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.success + "44",
  },
  verifiedText: { fontSize: 10, color: COLORS.success, ...FONTS.semiBold },
  providerMeta: { fontSize: 12, color: COLORS.textSecondary },
  expandBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  statsRow: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 12,
    gap: 2,
  },
  statPill: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 12, ...FONTS.semiBold, color: COLORS.text },
  statSub: { fontSize: 10, color: COLORS.textMuted },

  matchScoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  matchScoreLabel: { fontSize: 11, color: COLORS.textSecondary },
  matchScoreRight: { flexDirection: "row", alignItems: "baseline", gap: 1 },
  matchScoreNum: { fontSize: 18, ...FONTS.extraBold, color: COLORS.primary },
  matchScoreMax: { fontSize: 12, color: COLORS.textMuted },
  mainScoreBg: {
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    marginBottom: 14,
    overflow: "hidden",
  },
  mainScoreFill: {
    height: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 3,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },

  expandedSection: { marginBottom: 14 },
  breakdownTitle: {
    fontSize: 11,
    ...FONTS.bold,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  scoreBarRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  scoreBarLabel: { fontSize: 10, color: COLORS.textMuted, width: 48 },
  scoreBarBg: { flex: 1, height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: "hidden" },
  scoreBarFill: { height: 4, borderRadius: 2 },
  scoreBarVal: { fontSize: 10, ...FONTS.semiBold, width: 26, textAlign: "right" },

  aiReasonBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  aiReasonHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  aiReasonLabel: { fontSize: 10, ...FONTS.bold, color: COLORS.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  geminiChip: {
    backgroundColor: COLORS.primaryGlow,
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.primary + "44",
  },
  geminiChipText: { fontSize: 9, color: COLORS.primary, ...FONTS.semiBold },
  aiReasonText: { fontSize: 12, color: COLORS.textSecondary, fontStyle: "italic", lineHeight: 18 },

  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  bookBtnText: { color: "#fff", fontSize: 14, ...FONTS.semiBold },

  // Location banner
  locBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0A1A14", borderRadius: RADIUS.lg,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "#34D39933",
  },
  locLeft:     { flexDirection: "row", alignItems: "center", gap: 10 },
  locIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#34D39920", borderWidth: 1, borderColor: "#34D39955", alignItems: "center", justifyContent: "center" },
  locLabel:    { fontSize: 10, color: "#34D399", ...FONTS.semiBold, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  locCity:     { fontSize: 15, ...FONTS.bold, color: COLORS.text },
  locCoords:   { fontSize: 10, color: COLORS.textMuted, marginTop: 2, ...FONTS.mono },
  serviceTag:  { backgroundColor: COLORS.primaryGlow, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.primary + "44" },
  serviceTagText: { fontSize: 11, color: COLORS.primary, ...FONTS.semiBold, textTransform: "capitalize" },

  // Section dividers
  sectionDivider: {
    flexDirection: "row", alignItems: "center", gap: 7,
    marginBottom: 12, marginTop: 4,
  },
  sectionDividerText: { fontSize: 11, ...FONTS.bold, color: COLORS.primary, textTransform: "uppercase", letterSpacing: 0.7 },

  // Live section header
  webSectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginBottom: 12, marginTop: 8,
  },
  liveChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#34D39918", borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "#34D39944",
  },
  liveChipText: { fontSize: 9, color: "#34D399", ...FONTS.bold, letterSpacing: 0.8 },
  webSectionTitle: { fontSize: 11, ...FONTS.bold, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },

  // Scrape card — clean hierarchy
  scrapeCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.xl,
    padding: 16, borderWidth: 1, ...SHADOWS.md,
  },
  scRow:    { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  scIndex:  { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  scIndexText: { fontSize: 12, ...FONTS.bold },
  scName:   { fontSize: 15, ...FONTS.bold, color: COLORS.text, lineHeight: 21, marginBottom: 5 },
  scBadge:  { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: RADIUS.full, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  scBadgeText: { fontSize: 9, ...FONTS.semiBold },
  scRating: { alignItems: "flex-end", gap: 2, paddingTop: 2 },
  scRatingNum: { fontSize: 15, ...FONTS.bold, color: COLORS.warning },
  scReviews:   { fontSize: 9, color: COLORS.textMuted },

  scDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },

  scInfoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 7 },
  scInfoText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  scActions:     { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  scPhoneBtn:    { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 1 },
  scPhoneBtnText:{ color: "#fff", fontSize: 13, ...FONTS.semiBold, flexShrink: 1 },
  scWebBtn:      { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  scWebBtnText:  { fontSize: 13, ...FONTS.semiBold },
  scNoContact:   { flexDirection: "row", alignItems: "center", gap: 6, opacity: 0.45 },
  scNoContactText: { fontSize: 12, color: COLORS.textMuted, fontStyle: "italic" },

  webDisclaimer: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: 12, marginTop: 4, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  webDisclaimerText: { flex: 1, fontSize: 11, color: COLORS.textMuted, lineHeight: 16 },

  emptyState: { alignItems: "center", padding: 40, gap: 12 },
  emptyTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  emptyText:  { fontSize: 13, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20 },
});
