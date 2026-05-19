import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Animated, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { API } from "../../services/api";
import { COLORS, FONTS, RADIUS, SHADOWS, SERVICE_CATEGORIES } from "../../constants/theme";
import { StatusBadge } from "../../components/ui/Badge";
import { SkeletonCard } from "../../components/ui/Skeleton";

const DEMO_QUERIES = [
  { emoji: "🔧", text: "mujhe kal Gulshan mein plumber chahiye, 2000 se zyada nahi", label: "Plumber · Urdu" },
  { emoji: "⚡", text: "Need an electrician in DHA Lahore this Saturday, budget 3500 PKR", label: "Electrician · English" },
  { emoji: "🏥", text: "Doctor zaruri hai abhi Nazimabad mein, emergency", label: "Doctor · Emergency" },
];

function AnimatedNumber({ value, color }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const numVal = parseInt(value) || 0;
    Animated.timing(anim, { toValue: numVal, duration: 1000, useNativeDriver: false }).start();
    anim.addListener(({ value: v }) => setDisplayed(Math.round(v)));
    return () => anim.removeAllListeners();
  }, [value]);

  return <Text style={[styles.statValue, { color }]}>{displayed}</Text>;
}

function StatTile({ icon, value, label, color, style }) {
  return (
    <View style={[styles.statTile, style]}>
      <Ionicons name={icon} size={20} color={color} style={{ marginBottom: 8 }} />
      <AnimatedNumber value={value} color={color} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BookingPill({ booking }) {
  return (
    <View style={styles.bookingPill}>
      <View style={styles.bookingPillLeft}>
        <Text style={styles.pillService}>{booking.service}</Text>
        <Text style={styles.pillProvider}>{booking.provider_name}</Text>
        <Text style={styles.pillDate}>{booking.date} · {booking.time_slot?.split("–")[0]?.trim()}</Text>
      </View>
      <StatusBadge status={booking.status} />
    </View>
  );
}

export default function UserDashboard({ navigation }) {
  const { userProfile, signOut } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const bentoAnim = useRef(new Animated.Value(0)).current;

  const name = userProfile?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(bentoAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      const all = await API.getAllBookings();
      setBookings(all);
    } catch (_) {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, []);

  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;
  const confirmedCount = bookings.filter((b) => b.status === "CONFIRMED").length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{name} 👋</Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
            <Ionicons name="log-out-outline" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </Animated.View>

        {/* AI Search Banner */}
        <Animated.View style={{ opacity: bentoAnim, transform: [{ translateY: bentoAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
          <Pressable onPress={() => navigation.navigate("Search")}>
            {({ pressed }) => (
              <LinearGradient
                colors={["#1A1850", "#12123A", "#0D0D28"]}
                style={[styles.aiBanner, pressed && { opacity: 0.9 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* Glow orb */}
                <View style={styles.glowOrb} />

                <View style={styles.bannerContent}>
                  <View style={styles.bannerLeft}>
                    <View style={styles.aiBadge}>
                      <Ionicons name="sparkles" size={11} color={COLORS.primary} />
                      <Text style={styles.aiBadgeText}>5 AI Agents Ready</Text>
                    </View>
                    <Text style={styles.bannerTitle}>What do you need?</Text>
                    <Text style={styles.bannerSub}>Describe in Urdu or English</Text>
                  </View>

                  <View style={styles.searchBtn}>
                    <Ionicons name="search" size={18} color="#fff" />
                  </View>
                </View>

                {/* Agent pipeline pills */}
                <View style={styles.pipelineRow}>
                  {["Parse", "Search", "Rank", "Book", "Follow-up"].map((s, i) => (
                    <React.Fragment key={i}>
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>{i + 1}. {s}</Text>
                      </View>
                      {i < 4 && <Text style={styles.pipelineArrow}>›</Text>}
                    </React.Fragment>
                  ))}
                </View>
              </LinearGradient>
            )}
          </Pressable>
        </Animated.View>

        {/* Bento Stats Grid */}
        <View style={styles.bentoRow}>
          <StatTile icon="receipt-outline" value={bookings.length} label="Bookings" color={COLORS.primary} style={{ flex: 1 }} />
          <StatTile icon="checkmark-circle-outline" value={confirmedCount} label="Confirmed" color={COLORS.success} style={{ flex: 1 }} />
          <StatTile icon="time-outline" value={pendingCount} label="Pending" color={COLORS.warning} style={{ flex: 1 }} />
        </View>

        {/* Quick Categories */}
        <Text style={styles.sectionTitle}>Quick Search</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catScrollContent}>
          {SERVICE_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              style={({ pressed }) => [styles.catChip, { borderColor: cat.color + "55", opacity: pressed ? 0.8 : 1 }]}
              onPress={() => navigation.navigate("Search", { prefill: `I need a ${cat.label.toLowerCase()}` })}
            >
              <Text style={styles.catChipIcon}>{cat.icon}</Text>
              <Text style={[styles.catChipLabel, { color: cat.color }]}>{cat.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Live Search banner */}
        <Pressable
          style={({ pressed }) => [styles.liveSearchCard, pressed && { opacity: 0.85 }]}
          onPress={() => navigation.navigate("LiveSearch")}
        >
          <LinearGradient colors={["#0D1A18", "#071410"]} style={styles.liveSearchGrad}>
            <View style={styles.liveSearchLeft}>
              <View style={styles.liveSearchIconWrap}>
                <Ionicons name="wifi-outline" size={20} color="#34D399" />
              </View>
              <View>
                <View style={styles.liveSearchTitleRow}>
                  <Text style={styles.liveSearchTitle}>Live Provider Search</Text>
                  <View style={styles.livePill}>
                    <View style={styles.livePillDot} />
                    <Text style={styles.livePillText}>LIVE</Text>
                  </View>
                </View>
                <Text style={styles.liveSearchSub}>OpenStreetMap + DuckDuckGo · Real data</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#34D399" />
          </LinearGradient>
        </Pressable>

        {/* Demo Queries */}
        <Text style={styles.sectionTitle}>Try These</Text>
        {DEMO_QUERIES.map((s, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [styles.demoCard, pressed && styles.demoCardPressed]}
            onPress={() => navigation.navigate("Search", { prefill: s.text })}
          >
            <View style={styles.demoLeft}>
              <Text style={styles.demoEmoji}>{s.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoText} numberOfLines={2}>{s.text}</Text>
                <Text style={styles.demoLabel}>{s.label}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </Pressable>
        ))}

        {/* Recent Bookings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Bookings</Text>
          <TouchableOpacity onPress={() => navigation.navigate("BookingHistory")}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={36} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyText}>Search for a service to get started</Text>
          </View>
        ) : (
          bookings.slice(0, 3).map((b, i) => <BookingPill key={i} booking={b} />)
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  container: { padding: 20, paddingBottom: 48 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 2 },
  name: { fontSize: 26, ...FONTS.extraBold, color: COLORS.text },
  signOutBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  aiBanner: {
    borderRadius: RADIUS.xl,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary + "33",
    overflow: "hidden",
    ...SHADOWS.glow,
  },
  glowOrb: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.primary + "15",
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  bannerLeft: { flex: 1 },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.primaryGlow,
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.primary + "33",
  },
  aiBadgeText: { fontSize: 10, color: COLORS.primary, ...FONTS.semiBold },
  bannerTitle: { fontSize: 20, ...FONTS.bold, color: COLORS.text, marginBottom: 3 },
  bannerSub: { fontSize: 12, color: COLORS.textSecondary },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pipelineRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 4,
  },
  pill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pillText: { fontSize: 9, color: "rgba(255,255,255,0.5)", ...FONTS.medium },
  pipelineArrow: { color: "rgba(255,255,255,0.2)", fontSize: 12 },

  bentoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statTile: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { fontSize: 22, ...FONTS.extraBold, marginBottom: 2 },
  statLabel: { fontSize: 10, color: COLORS.textMuted, ...FONTS.medium },

  sectionTitle: {
    fontSize: 12,
    ...FONTS.bold,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, color: COLORS.primary, ...FONTS.medium },

  catScroll: { marginBottom: 24 },
  catScrollContent: { gap: 8, paddingRight: 4 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
  },
  catChipIcon: { fontSize: 16 },
  catChipLabel: { fontSize: 12, ...FONTS.semiBold },

  demoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  demoCardPressed: { opacity: 0.75 },
  demoLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, marginRight: 8 },

  // Live Search card
  liveSearchCard: { borderRadius: RADIUS.lg, overflow: "hidden", marginBottom: 18, borderWidth: 1, borderColor: "#34D39933", ...SHADOWS.md },
  liveSearchGrad: { flexDirection: "row", alignItems: "center", padding: 14, justifyContent: "space-between" },
  liveSearchLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  liveSearchIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#34D39918", borderWidth: 1, borderColor: "#34D39944", alignItems: "center", justifyContent: "center" },
  liveSearchTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  liveSearchTitle: { fontSize: 14, ...FONTS.semiBold, color: "#34D399" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#34D39918", borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#34D39944" },
  livePillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#34D399" },
  livePillText: { fontSize: 8, ...FONTS.bold, color: "#34D399", letterSpacing: 0.8 },
  liveSearchSub: { fontSize: 11, color: COLORS.textSecondary },
  demoEmoji: { fontSize: 20 },
  demoText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 2 },
  demoLabel: { fontSize: 10, color: COLORS.textMuted, ...FONTS.medium },

  bookingPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bookingPillLeft: { flex: 1, marginRight: 10 },
  pillService: { fontSize: 13, ...FONTS.semiBold, color: COLORS.text, marginBottom: 2 },
  pillProvider: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 2 },
  pillDate: { fontSize: 11, color: COLORS.textMuted },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, ...FONTS.semiBold, color: COLORS.text, marginTop: 4 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
});
