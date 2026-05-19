import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Animated, Linking,
  KeyboardAvoidingView, Platform, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { API } from "../../services/api";
import { COLORS, FONTS, RADIUS, SHADOWS } from "../../constants/theme";

let Location = null;
try { Location = require("expo-location"); } catch (_) {}

async function tryGetCoords() {
  if (!Location) return null;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy?.High ?? 4,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
  } catch { return null; }
}

function cleanAdminSuffix(s) {
  return (s || "").replace(/\s+(District|Division|Tehsil|City)$/i, "").trim();
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en&zoom=14`,
      { headers: { "User-Agent": "ServiceAI-Hackathon/1.0" } }
    );
    const data = await res.json();
    const addr = data.address || {};
    // City: clean "Karachi Division" → "Karachi", "Lahore District" → "Lahore"
    const rawDistrict = addr.district || "";
    const cleanDistrict = cleanAdminSuffix(rawDistrict);
    const cityRaw = addr.city || cleanDistrict || addr.city_district || addr.state_district || addr.county || addr.town || "";
    const city = cleanAdminSuffix(cityRaw);
    const area = addr.neighbourhood || addr.suburb || addr.quarter || addr.town || addr.village || addr.hamlet || "";
    const state = addr.state || "";
    const display = [area, city, state].filter(Boolean).join(", ");
    return { city, area, state, display };
  } catch { return {}; }
}

const QUICK_SERVICES = [
  { label: "Plumber",      icon: "water-outline",       value: "plumber" },
  { label: "Electrician",  icon: "flash-outline",       value: "electrician" },
  { label: "Doctor",       icon: "medkit-outline",      value: "doctor" },
  { label: "Tutor",        icon: "school-outline",      value: "tutor" },
  { label: "AC Repair",    icon: "thermometer-outline", value: "AC technician" },
  { label: "Carpenter",    icon: "construct-outline",   value: "carpenter" },
];

const CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan"];

// ── Source Badge ──────────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  const color = "#4285F4";
  const label = source === "google_maps" ? "Google Maps" : "Google Search";
  return (
    <View style={[styles.badge, { backgroundColor: color + "18", borderColor: color + "44" }]}>
      <Ionicons name="logo-google" size={9} color={color} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function formatHours(hours) {
  if (!hours) return null;
  if (typeof hours === "string") return hours.slice(0, 60);
  const entries = Object.entries(hours);
  if (!entries.length) return null;
  return entries.slice(0, 2).map(([d, h]) => `${d}: ${h}`).join("  |  ");
}

// ── Result Card ───────────────────────────────────────────────────────────────
function ResultCard({ item, index }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, delay: index * 60, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 9,   delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const accent = "#4285F4";
  const address = [item.address, item.city].filter(Boolean).join(", ");
  const link    = item.source_url || item.website || item.url || null;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], marginBottom: 12 }}>
      <View style={[styles.resultCard, { borderLeftWidth: 3, borderLeftColor: accent }]}>

        {/* Name row */}
        <View style={styles.rcNameRow}>
          <Text style={[styles.rcNum, { color: accent }]}>#{index + 1}</Text>
          <Text style={styles.rcName} numberOfLines={2}>{item.name}</Text>
        </View>

        {/* Address */}
        {(address || item.description) ? (
          <View style={styles.rcInfoRow}>
            <Ionicons name="location-outline" size={13} color={COLORS.textMuted} style={styles.rcIcon} />
            <Text style={styles.rcInfoText} numberOfLines={2}>
              {address || item.description}
            </Text>
          </View>
        ) : null}

        {/* Distance */}
        {item.distance_km != null ? (
          <View style={styles.rcInfoRow}>
            <Ionicons name="navigate-outline" size={13} color={accent} style={styles.rcIcon} />
            <Text style={[styles.rcInfoText, { color: accent, fontWeight: "600" }]}>
              {item.distance_km} km from your location
            </Text>
          </View>
        ) : null}

        {/* Phone + Link row */}
        <View style={styles.rcActions}>
          {item.phone ? (
            <TouchableOpacity
              style={styles.rcPhoneBtn}
              onPress={() => Linking.openURL(`tel:${item.phone.replace(/[\s\-()]/g, "")}`)}
              activeOpacity={0.85}
            >
              <Ionicons name="call" size={13} color="#fff" />
              <Text style={styles.rcPhoneText}>{item.phone}</Text>
            </TouchableOpacity>
          ) : null}
          {link ? (
            <TouchableOpacity
              style={[styles.rcLinkBtn, { borderColor: accent + "66" }]}
              onPress={() => Linking.openURL(link)}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={13} color={accent} />
              <Text style={[styles.rcLinkText, { color: accent }]}>View on Google Maps</Text>
            </TouchableOpacity>
          ) : null}
        </View>

      </View>
    </Animated.View>
  );
}

// ── Location Banner ───────────────────────────────────────────────────────────
function LocationBanner({ result, gpsInfo }) {
  // Prefer the backend's resolved English display name; fall back to frontend GPS info
  const displayPlace = result?.location_display
    || result?.location
    || gpsInfo?.display
    || [gpsInfo?.area, gpsInfo?.city, gpsInfo?.state].filter(Boolean).join(", ")
    || "Your location";

  const lat = gpsInfo?.lat ?? result?.geocoded_at?.lat;
  const lng = gpsInfo?.lng ?? result?.geocoded_at?.lng;
  const coordStr = lat != null && lng != null
    ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    : null;

  return (
    <View style={styles.locBanner}>
      <Ionicons name="location" size={20} color="#34D399" />
      <View style={styles.locBannerLeft}>
        <Text style={styles.locBannerLabel}>Results based on your location</Text>
        <Text style={styles.locBannerCity}>{displayPlace}</Text>
        {coordStr && <Text style={styles.locBannerCoord}>{coordStr}</Text>}
      </View>
      <View style={styles.locBannerBadge}>
        <Text style={styles.locBannerBadgeTxt}>GPS</Text>
      </View>
    </View>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ result }) {
  if (!result) return null;
  const withPhone = result.providers.filter(p => p.phone).length;
  return (
    <View style={styles.statsBar}>
      <View style={styles.statsItem}>
        <Text style={[styles.statsNum, { color: "#4285F4" }]}>{result.found}</Text>
        <Text style={styles.statsLabel}>Found</Text>
      </View>
      <View style={styles.statsDivider} />
      <View style={styles.statsItem}>
        <Text style={[styles.statsNum, { color: "#34A853" }]}>{withPhone}</Text>
        <Text style={styles.statsLabel}>With Phone</Text>
      </View>
      <View style={styles.statsDivider} />
      <View style={styles.statsItem}>
        <Text style={styles.statsNum}>{(result.duration_ms / 1000).toFixed(1)}s</Text>
        <Text style={styles.statsLabel}>Fetch Time</Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function LiveSearchScreen({ navigation }) {
  const [serviceType, setServiceType] = useState("");
  const [location,    setLocation]    = useState("");
  const [city,        setCity]        = useState("Karachi");
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState("");
  const [gpsInfo,     setGpsInfo]     = useState(null); // { lat, lng, city, area }
  const [gpsLoading,  setGpsLoading]  = useState(true);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    // Auto-detect location on mount
    (async () => {
      const coords = await tryGetCoords();
      if (coords) {
        const geo = await reverseGeocode(coords.lat, coords.lng);
        const info = { lat: coords.lat, lng: coords.lng, ...geo };
        setGpsInfo(info);
        if (geo.city)  setCity(geo.city);
        if (geo.area)  setLocation(geo.area);
      }
      setGpsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (!serviceType.trim()) { setError("Please enter a service type."); return; }
    setError("");
    setLoading(true);
    setResult(null);

    // Prefer cached GPS; fall back to fresh fetch
    const coords = gpsInfo ?? await tryGetCoords();

    try {
      const data = await API.scrape(
        serviceType.trim(),
        location.trim(),
        city.trim(),
        coords?.lat,
        coords?.lng,
        10,
      );
      setResult(data);
    } catch (e) {
      setError("Search failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Live Search</Text>
                <Text style={styles.subtitle}>
                  {gpsLoading
                    ? "Detecting your location..."
                    : gpsInfo?.display || gpsInfo?.city
                      ? `📍 ${gpsInfo.display || [gpsInfo.area, gpsInfo.city].filter(Boolean).join(", ")}`
                      : "Real-time data · OpenStreetMap & Web"}
                </Text>
              </View>
              <View style={styles.liveDot}>
                {gpsLoading
                  ? <ActivityIndicator size="small" color="#34D399" style={{ width: 7, height: 7 }} />
                  : <View style={styles.liveDotInner} />}
              </View>
            </View>
          </Animated.View>

          {/* Source info banner */}
          <LinearGradient colors={["#0C0E18", "#070810"]} style={styles.infoBanner}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: "#4285F418", borderColor: "#4285F444" }]}>
                <Ionicons name="logo-google" size={14} color="#4285F4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: "#4285F4" }]}>Google Search</Text>
                <Text style={styles.infoDesc}>Scraped live from Google · each result links to Google Maps</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Quick service select */}
          <Text style={styles.sectionLabel}>Quick Select Service</Text>
          <View style={styles.quickGrid}>
            {QUICK_SERVICES.map((s) => (
              <Pressable
                key={s.value}
                style={[
                  styles.quickCard,
                  serviceType === s.value && { borderColor: COLORS.primary + "88", backgroundColor: COLORS.primaryGlow },
                ]}
                onPress={() => setServiceType(s.value)}
              >
                <Ionicons name={s.icon} size={20} color={serviceType === s.value ? COLORS.primary : COLORS.textMuted} />
                <Text style={[styles.quickLabel, serviceType === s.value && { color: COLORS.primary }]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Service input */}
          <Text style={styles.sectionLabel}>Or Type a Service</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="search-outline" size={16} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={serviceType}
              onChangeText={setServiceType}
              placeholder="e.g. math tutor, painter, mechanic..."
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          {/* Location inputs */}
          <Text style={styles.sectionLabel}>Location</Text>
          <View style={styles.locationRow}>
            <View style={[styles.inputWrap, { flex: 1 }]}>
              <Ionicons name="navigate-outline" size={16} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Area (e.g. DHA, Gulshan)"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {/* City pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityScroll} contentContainerStyle={styles.cityRow}>
            {CITIES.map((c) => (
              <Pressable
                key={c}
                style={[styles.cityPill, city === c && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                onPress={() => setCity(c)}
              >
                <Text style={[styles.cityText, city === c && { color: "#fff" }]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Error */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={14} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Search button */}
          <TouchableOpacity
            style={[styles.searchBtn, loading && { opacity: 0.7 }]}
            onPress={handleSearch}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#34D399", "#10B981"]} style={styles.searchBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="wifi-outline" size={18} color="#fff" />
              )}
              <Text style={styles.searchBtnText}>
                {loading ? "Scraping live data..." : "Search Live Providers"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Results */}
          {result && (
            <>
              <LocationBanner result={result} gpsInfo={gpsInfo} />
              <StatsBar result={result} />

              {result.found === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={40} color={COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>No results found</Text>
                  <Text style={styles.emptyText}>
                    Try a broader area or different service name. OpenStreetMap coverage in Pakistan is growing.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.resultsHeader}>
                    <Text style={styles.resultsTitle}>
                      {result.found} Provider{result.found !== 1 ? "s" : ""} Found
                    </Text>
                    <View style={styles.liveChip}>
                      <Ionicons name="wifi-outline" size={10} color="#34D399" />
                      <Text style={styles.liveText}>LIVE DATA</Text>
                    </View>
                  </View>

                  {result.providers.map((item, i) => (
                    <ResultCard key={i} item={item} index={i} />
                  ))}

                  <View style={styles.disclaimerBox}>
                    <Ionicons name="information-circle-outline" size={13} color={COLORS.textMuted} />
                    <Text style={styles.disclaimerText}>
                      Data from Google Maps & Google Search. Saved to: {result.saved_to?.split(/[/\\]/).slice(-1)[0]}
                    </Text>
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 48 },

  headerRow:   { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn:     { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  title:       { fontSize: 22, ...FONTS.extraBold, color: COLORS.text },
  subtitle:    { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  liveDot:     { width: 14, height: 14, borderRadius: 7, backgroundColor: "#34D39933", alignItems: "center", justifyContent: "center", marginLeft: "auto" },
  liveDotInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#34D399" },

  infoBanner: { borderRadius: RADIUS.lg, padding: 14, marginBottom: 20, gap: 10, borderWidth: 1, borderColor: "#34D39922" },
  infoRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  infoIcon:   { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  infoLabel:  { fontSize: 12, ...FONTS.semiBold, marginBottom: 2 },
  infoDesc:   { fontSize: 11, color: COLORS.textMuted },

  sectionLabel: { fontSize: 11, ...FONTS.bold, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  quickCard: {
    width: "30.5%", backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  quickLabel: { fontSize: 11, ...FONTS.semiBold, color: COLORS.textMuted },

  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, marginBottom: 12,
  },
  inputIcon: { marginRight: 8 },
  input:     { flex: 1, color: COLORS.text, fontSize: 14, paddingVertical: 12 },

  locationRow: { flexDirection: "row", gap: 8, marginBottom: 4 },

  cityScroll: { marginBottom: 16 },
  cityRow:    { gap: 8, paddingRight: 4 },
  cityPill:   {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cityText: { fontSize: 13, color: COLORS.textSecondary, ...FONTS.medium },

  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.dangerGlow, borderRadius: RADIUS.md,
    padding: 10, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.danger + "44",
  },
  errorText: { flex: 1, fontSize: 12, color: COLORS.danger },

  searchBtn:     { borderRadius: RADIUS.lg, overflow: "hidden", marginBottom: 20, ...SHADOWS.glow },
  searchBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15, borderRadius: RADIUS.lg },
  searchBtnText: { color: "#fff", fontSize: 16, ...FONTS.semiBold },

  // Stats bar
  statsBar:     { flexDirection: "row", backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  statsItem:    { flex: 1, alignItems: "center" },
  statsNum:     { fontSize: 20, ...FONTS.extraBold, color: COLORS.text },
  statsLabel:   { fontSize: 9, color: COLORS.textMuted, marginTop: 2, textAlign: "center" },
  statsDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 4 },

  resultsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  resultsTitle:  { fontSize: 15, ...FONTS.bold, color: COLORS.text },
  liveChip:      { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#34D39918", borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#34D39944" },
  liveText:      { fontSize: 9, ...FONTS.bold, color: "#34D399", letterSpacing: 0.8 },

  // Result card container
  resultCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.xl,
    padding: 14, borderWidth: 1, ...SHADOWS.md,
  },
  badge:     { flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start", borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  badgeText: { fontSize: 9, ...FONTS.semiBold },

  // rc* — result card inner layout
  rcNameRow:  { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  rcNum:      { fontSize: 13, ...FONTS.extraBold, minWidth: 26, paddingTop: 1 },
  rcName:     { flex: 1, fontSize: 15, ...FONTS.bold, color: COLORS.text, lineHeight: 21 },
  rcInfoRow:  { flexDirection: "row", alignItems: "flex-start", gap: 7, marginBottom: 7 },
  rcIcon:     { marginTop: 1 },
  rcInfoText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  rcActions:  { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  rcPhoneBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.success, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 1 },
  rcPhoneText:{ color: "#fff", fontSize: 12, ...FONTS.semiBold, flexShrink: 1 },
  rcLinkBtn:  { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, backgroundColor: "transparent" },
  rcLinkText: { fontSize: 12, ...FONTS.semiBold },

  // Location banner (shown after search)
  locBanner:      { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#34D39933" },
  locBannerLeft:  { flex: 1 },
  locBannerLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  locBannerCity:  { fontSize: 13, ...FONTS.bold, color: COLORS.text },
  locBannerCoord: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  locBannerBadge: { backgroundColor: "#34D39918", borderRadius: RADIUS.md, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#34D39944" },
  locBannerBadgeTxt: { fontSize: 10, ...FONTS.semiBold, color: "#34D399" },

  // Empty
  emptyState: { alignItems: "center", padding: 32, gap: 10 },
  emptyTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  emptyText:  { fontSize: 13, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20 },

  // Disclaimer
  disclaimerBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginTop: 8 },
  disclaimerText: { flex: 1, fontSize: 10, color: COLORS.textMuted, lineHeight: 15 },
});
