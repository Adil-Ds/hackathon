import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, FlatList,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db as firestoreDB } from "../../config/firebase";
import { ChatAPI } from "../../services/chatApi";
import { API } from "../../services/api";
import { COLORS, RADIUS } from "../../constants/theme";

// ── Firestore provider query ──────────────────────────────────────────────────
async function fetchFirestoreProviders(categoryFilter, cityFilter, textQuery) {
  try {
    const snap = await getDocs(
      query(collection(firestoreDB, "users"), where("role", "==", "provider"))
    );
    let list = snap.docs.map((d) => d.data());

    if (categoryFilter && categoryFilter !== "all") {
      list = list.filter((p) =>
        (p.category || "").toLowerCase().includes(categoryFilter.toLowerCase())
      );
    }
    if (cityFilter && cityFilter.trim()) {
      const c = cityFilter.trim().toLowerCase();
      list = list.filter((p) => (p.city || "").toLowerCase().includes(c));
    }
    if (textQuery) {
      const q = textQuery.toLowerCase();
      list = list.filter((p) =>
        (p.name        || "").toLowerCase().includes(q) ||
        (p.businessName|| "").toLowerCase().includes(q) ||
        (p.category    || "").toLowerCase().includes(q) ||
        (p.area        || "").toLowerCase().includes(q)
      );
    }

    return list.map((p) => ({
      id:               p.uid,
      source:           "firestore",
      business_name:    p.businessName || p.name || "Provider",
      category:         p.category     || "service",
      city:             p.city         || "",
      area:             p.area         || "",
      rating:           0,
      review_count:     0,
      is_verified:      false,
      experience_years: Number(p.experienceYears) || 0,
      price_min:        0,
      price_max:        0,
      distance_km:      null,
      phone:            p.phone        || null,
      skills:           [],
      _firebase_uid:    p.uid,
      _email:           p.email,
      _name:            p.name,
      _role:            "provider",
    }));
  } catch (e) {
    console.warn("[Browse] Firestore query failed:", e.message);
    return [];
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",         label: "All",         icon: "apps-outline" },
  { id: "plumber",     label: "Plumber",     icon: "water-outline" },
  { id: "electrician", label: "Electrician", icon: "flash-outline" },
  { id: "tutor",       label: "Tutor",       icon: "school-outline" },
  { id: "carpenter",   label: "Carpenter",   icon: "hammer-outline" },
  { id: "painter",     label: "Painter",     icon: "color-palette-outline" },
  { id: "doctor",      label: "Doctor",      icon: "medkit-outline" },
  { id: "cleaner",     label: "Cleaner",     icon: "sparkles-outline" },
  { id: "mechanic",    label: "Mechanic",    icon: "construct-outline" },
  { id: "gardener",    label: "Gardener",    icon: "leaf-outline" },
  { id: "other",       label: "Other",       icon: "ellipsis-horizontal-outline" },
];

const POPULAR_CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar"];

const SORT_OPTIONS = [
  { id: "relevance",  label: "Best Match" },
  { id: "rating",     label: "Top Rated" },
  { id: "price_asc",  label: "Price ↑" },
  { id: "price_desc", label: "Price ↓" },
  { id: "experience", label: "Experience" },
];

const RATING_OPTIONS = [null, 3.0, 3.5, 4.0, 4.5];

const DEFAULT_FILTERS = {
  category:       "all",
  city:           "",
  min_rating:     null,
  min_experience: null,
  verified_only:  false,
  sort_by:        "relevance",
};

// ── Provider card ─────────────────────────────────────────────────────────────
function StarRow({ rating }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= Math.round(rating) ? "star" : "star-outline"}
          size={11}
          color={COLORS.warning}
        />
      ))}
    </View>
  );
}

function ProviderCard({ item, onPress, onChat }) {
  const priceStr =
    item.price_min > 0
      ? item.price_max > 0
        ? `₨${item.price_min.toLocaleString()}–${item.price_max.toLocaleString()}`
        : `From ₨${item.price_min.toLocaleString()}`
      : "Price on request";

  return (
    <TouchableOpacity style={pc.card} onPress={onPress} activeOpacity={0.82}>
      <View style={pc.header}>
        <View
          style={[
            pc.avatar,
            {
              backgroundColor:
                item.source === "platform"
                  ? COLORS.primary + "20"
                  : COLORS.violet + "20",
            },
          ]}
        >
          <Ionicons
            name="storefront-outline"
            size={20}
            color={item.source === "platform" ? COLORS.primary : COLORS.violet}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={pc.name} numberOfLines={1}>
              {item.business_name}
            </Text>
            {item.is_verified && (
              <Ionicons name="shield-checkmark" size={13} color={COLORS.success} />
            )}
          </View>
          <Text style={pc.category}>
            {item.category} · {item.area}, {item.city}
          </Text>
        </View>
        {item.distance_km != null && (
          <View style={pc.distBadge}>
            <Ionicons name="location-outline" size={10} color={COLORS.primary} />
            <Text style={pc.distText}>{item.distance_km}km</Text>
          </View>
        )}
      </View>

      <View style={pc.ratingRow}>
        <StarRow rating={item.rating} />
        <Text style={pc.ratingVal}>{item.rating.toFixed(1)}</Text>
        <Text style={pc.reviewCnt}>({item.review_count})</Text>
        {item.experience_years > 0 && (
          <>
            <View style={pc.dot} />
            <Text style={pc.exp}>{item.experience_years}y exp</Text>
          </>
        )}
        <View style={{ flex: 1 }} />
        <Text style={pc.price}>{priceStr}</Text>
      </View>

      {item.skills?.length > 0 && (
        <View style={pc.skillRow}>
          {item.skills.slice(0, 3).map((sk, i) => (
            <View key={i} style={pc.skillPill}>
              <Text style={pc.skillText}>{sk}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={pc.ctaRow}>
        <TouchableOpacity style={pc.chatBtn} onPress={onChat} activeOpacity={0.8}>
          <Ionicons name="chatbubble-outline" size={13} color={COLORS.primary} />
          <Text style={pc.chatBtnText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pc.bookBtn} onPress={onPress} activeOpacity={0.85}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={pc.bookBtnGrad}
          >
            <Text style={pc.bookBtnText}>View Profile</Text>
            <Ionicons name="arrow-forward" size={12} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── Filter sheet (city + service + rating + experience + verified + sort) ──────
function FilterSheet({ visible, filters, onApply, onClose }) {
  const [local, setLocal] = useState(filters);
  const [mounted, setMounted] = useState(visible);
  const ty = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setLocal(filters);
      Animated.spring(ty, {
        toValue: 0,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(ty, {
        toValue: 600,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        // Only unmount AFTER the close animation actually completes,
        // so the full-screen overlay can never linger and block touches.
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <View style={fs.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        activeOpacity={1}
      />
      <Animated.View style={[fs.sheet, { transform: [{ translateY: ty }] }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={fs.handle} />
          <Text style={fs.title}>Filters</Text>

          {/* City */}
          <Text style={fs.sec}>City</Text>
          <View style={fs.cityInputRow}>
            <Ionicons name="location-outline" size={15} color={COLORS.primary} style={{ marginLeft: 10 }} />
            <TextInput
              style={fs.cityInput}
              value={local.city}
              onChangeText={(v) => setLocal((p) => ({ ...p, city: v }))}
              placeholder="Any city (e.g. Lahore, Karachi…)"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
            />
            {local.city.length > 0 && (
              <TouchableOpacity
                onPress={() => setLocal((p) => ({ ...p, city: "" }))}
                style={{ paddingRight: 10 }}
              >
                <Ionicons name="close-circle" size={15} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <View style={fs.row}>
            {POPULAR_CITIES.map((c) => {
              const active = local.city.trim().toLowerCase() === c.toLowerCase();
              return (
                <TouchableOpacity
                  key={c}
                  style={[fs.pill, active && fs.pillActive]}
                  onPress={() =>
                    setLocal((p) => ({ ...p, city: active ? "" : c }))
                  }
                  activeOpacity={0.75}
                >
                  <Text style={[fs.pillText, active && { color: "#fff" }]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Service / Category */}
          <Text style={fs.sec}>Service</Text>
          <View style={fs.row}>
            {CATEGORIES.map((cat) => {
              const active = local.category === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[fs.catPill, active && fs.pillActive]}
                  onPress={() => setLocal((p) => ({ ...p, category: cat.id }))}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={cat.icon}
                    size={12}
                    color={active ? "#fff" : COLORS.textMuted}
                  />
                  <Text style={[fs.pillText, active && { color: "#fff" }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Minimum rating */}
          <Text style={fs.sec}>Minimum Rating</Text>
          <View style={fs.row}>
            {RATING_OPTIONS.map((r) => (
              <TouchableOpacity
                key={String(r)}
                style={[fs.pill, local.min_rating === r && fs.pillActive]}
                onPress={() => setLocal((p) => ({ ...p, min_rating: r }))}
                activeOpacity={0.75}
              >
                {r ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Ionicons
                      name="star"
                      size={10}
                      color={local.min_rating === r ? "#fff" : COLORS.warning}
                    />
                    <Text style={[fs.pillText, local.min_rating === r && { color: "#fff" }]}>
                      {r}+
                    </Text>
                  </View>
                ) : (
                  <Text style={[fs.pillText, local.min_rating === r && { color: "#fff" }]}>
                    Any
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Experience */}
          <Text style={fs.sec}>Min. Experience</Text>
          <View style={fs.row}>
            {[null, 1, 3, 5, 10].map((yr) => (
              <TouchableOpacity
                key={String(yr)}
                style={[fs.pill, local.min_experience === yr && fs.pillActive]}
                onPress={() => setLocal((p) => ({ ...p, min_experience: yr }))}
                activeOpacity={0.75}
              >
                <Text style={[fs.pillText, local.min_experience === yr && { color: "#fff" }]}>
                  {yr ? `${yr}y+` : "Any"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Verified */}
          <TouchableOpacity
            style={[fs.toggle, local.verified_only && fs.toggleOn]}
            onPress={() => setLocal((p) => ({ ...p, verified_only: !p.verified_only }))}
            activeOpacity={0.8}
          >
            <Ionicons
              name={local.verified_only ? "shield-checkmark" : "shield-outline"}
              size={17}
              color={local.verified_only ? COLORS.success : COLORS.textMuted}
            />
            <Text style={[fs.toggleText, local.verified_only && { color: COLORS.success }]}>
              Verified providers only
            </Text>
            <Ionicons
              name={local.verified_only ? "checkmark-circle" : "ellipse-outline"}
              size={17}
              color={local.verified_only ? COLORS.success : COLORS.border}
            />
          </TouchableOpacity>

          {/* Sort */}
          <Text style={fs.sec}>Sort by</Text>
          <View style={fs.row}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[fs.pill, local.sort_by === opt.id && fs.pillActive]}
                onPress={() => setLocal((p) => ({ ...p, sort_by: opt.id }))}
                activeOpacity={0.75}
              >
                <Text style={[fs.pillText, local.sort_by === opt.id && { color: "#fff" }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Footer */}
          <View style={fs.footer}>
            <TouchableOpacity
              style={fs.resetBtn}
              activeOpacity={0.75}
              onPress={() => setLocal({ ...DEFAULT_FILTERS })}
            >
              <Text style={fs.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={fs.applyBtn}
              onPress={() => onApply(local)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.violet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={fs.applyGrad}
              >
                <Text style={fs.applyText}>Apply Filters</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProviderDiscoveryScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total,       setTotal]       = useState(0);
  const [offset,      setOffset]      = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });

  const searchTimer = useRef(null);
  const LIMIT = 15;

  // ── GPS location (for distance sorting only) ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch (_) {}
    })();
  }, []);

  // ── Core search ────────────────────────────────────────────────────────────
  const doSearch = useCallback(
    async (q, f, off = 0) => {
      if (off === 0) setLoading(true);
      else           setLoadingMore(true);

      let backendResults = [];
      let backendTotal   = 0;

      // 1. PostgreSQL backend
      try {
        const data = await ChatAPI.searchProviders({
          q:              q.trim()         || undefined,
          category:       f.category !== "all" ? f.category : undefined,
          city:           f.city.trim()    || undefined,
          min_rating:     f.min_rating     || undefined,
          min_experience: f.min_experience || undefined,
          verified_only:  f.verified_only  || undefined,
          sort_by:        f.sort_by        || "relevance",
          user_lat:       userLocation?.lat,
          user_lng:       userLocation?.lng,
          limit: LIMIT,
          offset: off,
        });
        backendResults = data.results || [];
        backendTotal   = data.total   || 0;
      } catch (_) {
        // Fallback to static JSON providers
        try {
          const all = await API.getProviders();
          let filtered = all || [];
          if (f.category !== "all")
            filtered = filtered.filter((p) =>
              (p.category || "").toLowerCase().includes(f.category)
            );
          if (f.city.trim())
            filtered = filtered.filter((p) =>
              (p.city || "").toLowerCase().includes(f.city.trim().toLowerCase())
            );
          if (q.trim())
            filtered = filtered.filter(
              (p) =>
                (p.name     || "").toLowerCase().includes(q.toLowerCase()) ||
                (p.category || "").toLowerCase().includes(q.toLowerCase())
            );
          backendResults = filtered.map((p) => ({
            id:               p.id,
            source:           "scraped",
            business_name:    p.name,
            category:         p.category,
            city:             p.city,
            area:             p.area,
            rating:           parseFloat(p.rating) || 0,
            review_count:     p.review_count || 0,
            is_verified:      !!p.verified,
            experience_years: p.experience_years || 0,
            price_min:        p.price_min || 0,
            price_max:        p.price_max || 0,
            distance_km:      null,
            skills:           [],
          }));
          backendTotal = backendResults.length;
        } catch (_2) {}
      }

      // 2. Firestore registered providers (merged on first page)
      let firestoreProviders = [];
      if (off === 0) {
        firestoreProviders = await fetchFirestoreProviders(f.category, f.city, q);
      }

      // 3. Merge & deduplicate
      if (off === 0) {
        const backendIds      = new Set(backendResults.map((p) => p.id));
        const uniqueFirestore = firestoreProviders.filter((p) => !backendIds.has(p.id));
        const merged = [...backendResults, ...uniqueFirestore];

        const finalResults = f.min_experience
          ? merged.filter((p) => p.experience_years >= f.min_experience)
          : merged;

        setTotal(backendTotal + uniqueFirestore.length);
        setResults(finalResults);
        setOffset(off + LIMIT);
      } else {
        setResults((prev) => [...prev, ...backendResults]);
        setOffset(off + LIMIT);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [userLocation]
  );

  // Debounced re-search on any change
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      doSearch(searchQuery, filters, 0);
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery, filters, userLocation]);

  const handleApplyFilters = (f) => {
    setFilters(f);
    setShowFilters(false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && results.length < total)
      doSearch(searchQuery, filters, offset);
  };

  const handleProviderPress = (item) => {
    navigation.navigate("ProviderPublicProfile", {
      providerId:   item.source === "platform" ? item.id   : null,
      providerData: item.source !== "platform"  ? item : null,
    });
  };

  const handleMessage = async (item) => {
    // Use Firebase UID so the provider's token resolves to the same ID stored
    // in conversation_participants. Platform (PG) providers expose firebase_uid;
    // Firestore providers have _firebase_uid == their Firebase UID.
    const chatUid = item.firebase_uid || item._firebase_uid || item.id;
    try {
      await ChatAPI.ensureUser(
        chatUid,
        item._email || `${chatUid}@placeholder.com`,
        item._name  || item.business_name,
        "provider",
        item.phone  || null
      );
    } catch (_) {}
    navigation.navigate("ChatRoom", {
      conversation: {
        id:              `new_${chatUid}`,
        participant_ids: [chatUid],
        booking_id:      null,
        _providerInfo:   item,
      },
    });
  };

  const activeFilterCount = [
    filters.category !== "all",
    filters.city.trim(),
    filters.min_rating,
    filters.min_experience,
    filters.verified_only,
    filters.sort_by !== "relevance",
  ].filter(Boolean).length;

  const activeCategoryLabel =
    CATEGORIES.find((c) => c.id === filters.category)?.label || "All";

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>

      {/* ── Search bar + filter button ── */}
      <View style={s.searchRow}>
        <View style={s.searchBar}>
          <Ionicons
            name="search-outline"
            size={17}
            color={COLORS.textMuted}
            style={{ marginLeft: 11 }}
          />
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search plumber, tutor, electrician…"
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={{ paddingRight: 10 }}
            >
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            s.filterBtn,
            activeFilterCount > 0 && { borderColor: COLORS.primary + "66" },
          ]}
          onPress={() => setShowFilters(true)}
          activeOpacity={0.8}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFilterCount > 0 ? COLORS.primary : COLORS.textMuted}
          />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Results header + active chips ── */}
      <View style={s.resultsHeader}>
        <Text style={s.resultCount}>
          {loading ? "Searching…" : `${total} providers`}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 5, alignItems: "center" }}
          style={{ flexGrow: 0, maxWidth: "70%" }}
        >
          {filters.category !== "all" && (
            <TouchableOpacity
              style={s.activeChip}
              onPress={() => setFilters((f) => ({ ...f, category: "all" }))}
            >
              <Text style={s.activeChipText}>{activeCategoryLabel} ×</Text>
            </TouchableOpacity>
          )}
          {filters.city.trim() !== "" && (
            <TouchableOpacity
              style={s.activeChip}
              onPress={() => setFilters((f) => ({ ...f, city: "" }))}
            >
              <Text style={s.activeChipText}>📍 {filters.city.trim()} ×</Text>
            </TouchableOpacity>
          )}
          {filters.verified_only && (
            <TouchableOpacity
              style={s.activeChip}
              onPress={() => setFilters((f) => ({ ...f, verified_only: false }))}
            >
              <Text style={s.activeChipText}>✓ Verified ×</Text>
            </TouchableOpacity>
          )}
          {filters.min_rating && (
            <TouchableOpacity
              style={s.activeChip}
              onPress={() => setFilters((f) => ({ ...f, min_rating: null }))}
            >
              <Text style={s.activeChipText}>★ {filters.min_rating}+ ×</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* ── Results ── */}
      {loading && results.length === 0 ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={s.loadingText}>Finding providers…</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, i) => `${item.source}_${item.id}_${i}`}
          renderItem={({ item }) => (
            <ProviderCard
              item={item}
              onPress={() => handleProviderPress(item)}
              onChat={() => handleMessage(item)}
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
            ) : null
          }
          ListEmptyComponent={
            !loading && (
              <View style={s.empty}>
                <Ionicons name="search-outline" size={48} color={COLORS.textMuted} />
                <Text style={s.emptyTitle}>No providers found</Text>
                <Text style={s.emptySub}>Try a different search or filters</Text>
                <TouchableOpacity
                  style={s.emptyReset}
                  onPress={() => {
                    setSearchQuery("");
                    setFilters({ ...DEFAULT_FILTERS });
                  }}
                >
                  <Text style={{ color: COLORS.primary, fontWeight: "700" }}>
                    Clear all filters
                  </Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}

      {/* ── Filter sheet ── */}
      <FilterSheet
        visible={showFilters}
        filters={filters}
        onApply={handleApplyFilters}
        onClose={() => setShowFilters(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.bg },
  searchRow:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  searchBar:  { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, height: 42 },
  searchInput:{ flex: 1, color: COLORS.text, fontSize: 14, paddingHorizontal: 8 },
  filterBtn:  { width: 42, height: 42, borderRadius: 11, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  filterBadge:{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  filterBadgeText: { fontSize: 9, color: "#fff", fontWeight: "800" },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 7, gap: 8 },
  resultCount:{ fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  activeChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.primary + "14", borderWidth: 1, borderColor: COLORS.primary + "33" },
  activeChipText: { fontSize: 10, color: COLORS.primary, fontWeight: "700" },
  list:       { paddingHorizontal: 12, paddingBottom: 90, paddingTop: 4 },
  centered:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText:{ fontSize: 13, color: COLORS.textMuted },
  empty:      { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  emptySub:   { fontSize: 13, color: COLORS.textMuted, textAlign: "center", paddingHorizontal: 30 },
  emptyReset: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary + "44" },
});

const pc = StyleSheet.create({
  card:       { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 13, marginBottom: 9 },
  header:     { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  avatar:     { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  name:       { fontSize: 13, fontWeight: "800", color: COLORS.text },
  category:   { fontSize: 11, color: COLORS.textMuted, textTransform: "capitalize", marginTop: 1 },
  distBadge:  { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: COLORS.primary + "12", borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3 },
  distText:   { fontSize: 10, color: COLORS.primary, fontWeight: "700" },
  ratingRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 7 },
  ratingVal:  { fontSize: 11, fontWeight: "700", color: COLORS.warning },
  reviewCnt:  { fontSize: 11, color: COLORS.textMuted },
  dot:        { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.textMuted },
  exp:        { fontSize: 11, color: COLORS.textMuted },
  price:      { fontSize: 12, fontWeight: "700", color: COLORS.success },
  skillRow:   { flexDirection: "row", gap: 5, flexWrap: "wrap", marginBottom: 9 },
  skillPill:  { backgroundColor: COLORS.surface, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.border },
  skillText:  { fontSize: 10, color: COLORS.textMuted, fontWeight: "600" },
  ctaRow:     { flexDirection: "row", gap: 7 },
  chatBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 9, borderWidth: 1, borderColor: COLORS.primary + "44", paddingVertical: 7, backgroundColor: COLORS.primary + "08" },
  chatBtnText:{ fontSize: 12, color: COLORS.primary, fontWeight: "700" },
  bookBtn:    { flex: 2, borderRadius: 9, overflow: "hidden" },
  bookBtnGrad:{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 7 },
  bookBtnText:{ fontSize: 12, fontWeight: "700", color: "#fff" },
});

const fs = StyleSheet.create({
  overlay:     { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 100, justifyContent: "flex-end" },
  sheet:       { backgroundColor: COLORS.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36, maxHeight: "85%", borderTopWidth: 1, borderColor: COLORS.borderLight },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 14 },
  title:       { fontSize: 17, fontWeight: "900", color: COLORS.text, marginBottom: 14 },
  sec:         { fontSize: 11, fontWeight: "700", color: COLORS.textMuted, marginBottom: 8, marginTop: 12, letterSpacing: 0.5, textTransform: "uppercase" },
  cityInputRow:{ flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, height: 40, marginBottom: 10 },
  cityInput:   { flex: 1, color: COLORS.text, fontSize: 13, paddingHorizontal: 8 },
  row:         { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill:        { paddingHorizontal: 13, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  catPill:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  pillActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText:    { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },
  toggle:      { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginTop: 12 },
  toggleOn:    { borderColor: COLORS.success + "44", backgroundColor: COLORS.success + "08" },
  toggleText:  { flex: 1, fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  footer:      { flexDirection: "row", gap: 10, marginTop: 22 },
  resetBtn:    { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border },
  resetText:   { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  applyBtn:    { flex: 2, borderRadius: 11, overflow: "hidden" },
  applyGrad:   { alignItems: "center", justifyContent: "center", paddingVertical: 13 },
  applyText:   { fontSize: 14, fontWeight: "800", color: "#fff" },
});
