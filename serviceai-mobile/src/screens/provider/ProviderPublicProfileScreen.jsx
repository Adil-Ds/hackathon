/**
 * ProviderPublicProfileScreen
 *
 * Works for three provider types:
 *   1. platform  — full profile from PostgreSQL via API  (pass providerId)
 *   2. firestore — registered app provider, basic data   (pass providerData)
 *   3. scraped   — JSON mock provider, basic data        (pass providerData)
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ChatAPI } from "../../services/chatApi";
import { API } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS, FONTS, RADIUS } from "../../constants/theme";

const TIME_SLOTS = [
  { id: "morning",   label: "09:00 – 11:00 AM", icon: "sunny-outline",       sub: "Morning" },
  { id: "midday",    label: "11:00 AM – 1:00 PM", icon: "partly-sunny-outline", sub: "Midday" },
  { id: "afternoon", label: "02:00 – 04:00 PM",  icon: "cloud-outline",       sub: "Afternoon" },
  { id: "evening",   label: "04:00 – 06:00 PM",  icon: "moon-outline",        sub: "Evening" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function StarRow({ rating, count }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= Math.round(rating) ? "star" : "star-outline"}
          size={14}
          color={COLORS.warning}
        />
      ))}
      {count != null && (
        <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          {Number(rating).toFixed(1)} ({count})
        </Text>
      )}
    </View>
  );
}

// ── Build a normalised profile object from any provider source ────────────────
function normaliseProfile(raw) {
  if (!raw) return null;
  return {
    id:               raw.id            || "",
    source:           raw.source        || "scraped",
    business_name:    raw.business_name || raw.businessName || raw.name || "Provider",
    category:         raw.category      || "service",
    city:             raw.city          || "",
    area:             raw.area          || "",
    rating:           Number(raw.rating)           || 0,
    review_count:     Number(raw.review_count)      || 0,
    is_verified:      Boolean(raw.is_verified || raw.verified),
    experience_years: Number(raw.experience_years || raw.experienceYears) || 0,
    bio:              raw.bio           || raw.address  || null,
    skills:           raw.skills        || [],
    languages:        raw.languages     || [],
    price_range:      raw.price_range   || {
      min: raw.price_min || 0,
      max: raw.price_max || 0,
    },
    website:          raw.website       || null,
    services:         raw.services      || [],
    availability:     raw.availability  || [],
    reviews:          raw.reviews       || [],
    phone:            raw.phone         || raw._phone || null,
    // For chat — firebase_uid is the canonical ID for conversation participants
    firebase_uid:     raw.firebase_uid  || null,
    _firebase_uid:    raw.firebase_uid  || raw._firebase_uid || (raw.source === "firestore" ? raw.id : null),
    _email:           raw._email        || null,
    _name:            raw._name         || raw.business_name || raw.name || null,
  };
}

export default function ProviderPublicProfileScreen({ route, navigation }) {
  const { providerId, providerData } = route.params || {};
  const { user, userProfile } = useAuth();

  const todayStr    = new Date().toISOString().split("T")[0];
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })();

  // ── Booking modal state ────────────────────────────────────────────────────
  const [showBooking,  setShowBooking]  = useState(false);
  const [bookingDate,  setBookingDate]  = useState(todayStr);
  const [selectedSlot, setSelectedSlot] = useState(TIME_SLOTS[0]);
  const [address,      setAddress]      = useState("");
  const [offeredPrice, setOfferedPrice] = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [booked,       setBooked]       = useState(false);

  const [profile, setProfile] = useState(
    providerData ? normaliseProfile(providerData) : null
  );
  const [loading, setLoading] = useState(!providerData && !!providerId);

  const load = useCallback(async () => {
    if (!providerId) return;
    try {
      const data = await ChatAPI.getProviderPublicProfile(providerId);
      setProfile(normaliseProfile(data));
    } catch (_) {
      // API failed — if we already have providerData use it
      if (providerData) setProfile(normaliseProfile(providerData));
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    if (!profile) load();
  }, []);

  // ── Handle "Message" tap ───────────────────────────────────────────────────
  const handleMessage = async () => {
    if (!profile) return;
    // Always use Firebase UID as participant so the provider's token resolves correctly.
    // For platform (PG) providers, firebase_uid comes from the backend.
    // For Firestore providers, _firebase_uid == their Firebase UID.
    const chatUid = profile.firebase_uid || profile._firebase_uid || profile.id;
    try {
      await ChatAPI.ensureUser(
        chatUid,
        profile._email || `${chatUid}@placeholder.com`,
        profile._name  || profile.business_name,
        "provider",
        profile.phone  || null,
      );
    } catch (_) {}
    navigation.navigate("ChatRoom", {
      conversation: {
        id:              `new_${chatUid}`,
        participant_ids: [chatUid],
        booking_id:      null,
        _providerInfo:   profile,
      },
    });
  };

  // ── Direct booking (creates PENDING booking, notifies provider) ───────────
  const handleDirectBook = async () => {
    if (!address.trim()) {
      Alert.alert("Address required", "Please enter your address so the provider knows where to come.");
      return;
    }
    setSubmitting(true);
    try {
      const providerId = profile.firebase_uid || profile._firebase_uid || profile.id;
      const price = parseInt(offeredPrice, 10) || profile.price_range?.min || 500;

      await API.book(
        {
          provider_id:      providerId,
          provider_name:    profile.business_name,
          service_category: profile.category,
          user_id:          user?.uid || "GUEST",
          user_name:        userProfile?.name || "User",
          user_location:    `${profile.area || ""}, ${profile.city || ""}`.trim().replace(/^,\s*/, ""),
          location_address: address.trim(),
          date:             bookingDate,
          time_slot:        selectedSlot.label,
          price_agreed:     price,
        },
        userProfile?.phone || "0300-0000000",
      );
      setBooked(true);
    } catch (e) {
      Alert.alert("Booking failed", e.message || "Could not submit booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // ── No data ───────────────────────────────────────────────────────────────
  if (!profile) {
    return (
      <SafeAreaView style={s.safe}>
        <TouchableOpacity style={s.backBtnAbsolute} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={s.centered}>
          <Ionicons name="person-outline" size={52} color={COLORS.textMuted} />
          <Text style={s.emptyTitle}>Provider not found</Text>
          <Text style={s.emptySub}>Profile data is unavailable</Text>
          <TouchableOpacity style={s.goBackBtn} onPress={() => navigation.goBack()}>
            <Text style={s.goBackText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const priceRange = profile.price_range || {};
  const priceStr =
    (priceRange.min > 0 || priceRange.max > 0)
      ? priceRange.min && priceRange.max
        ? `₨${Number(priceRange.min).toLocaleString()} – ₨${Number(priceRange.max).toLocaleString()}`
        : priceRange.min
        ? `From ₨${Number(priceRange.min).toLocaleString()}`
        : "Price on request"
      : "Price on request";

  const isFirestoreOrScraped = profile.source !== "platform";

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Hero ── */}
        <LinearGradient
          colors={[COLORS.primary + "30", COLORS.violet + "18", "transparent"]}
          style={s.hero}
        >
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>

          <View style={s.avatarCircle}>
            <Ionicons name="storefront" size={36} color={COLORS.primary} />
          </View>
          <Text style={s.bizName}>{profile.business_name}</Text>
          <Text style={s.category}>{profile.category}</Text>
          <StarRow rating={profile.rating} count={profile.review_count} />

          {/* Source badge */}
          {isFirestoreOrScraped && (
            <View style={s.sourceBadge}>
              <Ionicons
                name={profile.source === "firestore" ? "person-circle-outline" : "globe-outline"}
                size={11}
                color={COLORS.violet}
              />
              <Text style={s.sourceBadgeText}>
                {profile.source === "firestore" ? "App Provider" : "Listed Provider"}
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* ── Stats grid ── */}
        <View style={s.statsGrid}>
          {[
            { icon: "briefcase-outline",  label: "Experience", value: profile.experience_years > 0 ? `${profile.experience_years} yrs` : "New" },
            { icon: "cash-outline",       label: "Price",      value: priceStr },
            { icon: "location-outline",   label: "Area",       value: `${profile.area || "—"}, ${profile.city || "—"}` },
            {
              icon:  profile.is_verified ? "shield-checkmark" : "shield-outline",
              label: "Verified",
              value: profile.is_verified ? "Verified" : "Unverified",
              color: profile.is_verified ? COLORS.success : COLORS.textMuted,
            },
          ].map((stat, i) => (
            <View key={i} style={s.statCard}>
              <Ionicons name={stat.icon} size={18} color={stat.color || COLORS.primary} />
              <Text style={[s.statValue, stat.color && { color: stat.color }]} numberOfLines={1}>
                {stat.value}
              </Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Bio / Address ── */}
        {profile.bio ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>About</Text>
            <Text style={s.bioText}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* ── Contact info for non-platform providers ── */}
        {profile.phone && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Contact</Text>
            <View style={s.contactRow}>
              <Ionicons name="call-outline" size={16} color={COLORS.success} />
              <Text style={s.contactText}>{profile.phone}</Text>
            </View>
          </View>
        )}

        {/* ── Skills ── */}
        {profile.skills?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Skills</Text>
            <View style={s.pillRow}>
              {profile.skills.map((sk, i) => (
                <View key={i} style={s.pill}>
                  <Text style={s.pillText}>{sk}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Services (platform providers only) ── */}
        {profile.services?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Services</Text>
            {profile.services.map((svc) => (
              <View key={svc.id} style={s.serviceCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.serviceName}>{svc.name}</Text>
                  {svc.description ? (
                    <Text style={s.serviceDesc} numberOfLines={2}>{svc.description}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.servicePrice}>
                    {svc.price_min > 0 ? `₨${svc.price_min.toLocaleString()}` : "Free"}
                  </Text>
                  <Text style={s.serviceDuration}>{svc.duration_minutes} min</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Availability (platform providers only) ── */}
        {profile.availability?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Availability</Text>
            <View style={s.availGrid}>
              {DAYS.map((day, i) => {
                const slot      = profile.availability.find((a) => a.day_of_week === i);
                const available = slot?.is_available ?? false;
                return (
                  <View key={day} style={[s.availDay, available ? s.availDayOn : s.availDayOff]}>
                    <Text style={[s.availDayText, !available && { color: COLORS.textMuted }]}>{day}</Text>
                    {available && (
                      <Text style={s.availTime}>{slot.start_time}–{slot.end_time}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Reviews (platform providers only) ── */}
        {profile.reviews?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Reviews ({profile.review_count})</Text>
            {profile.reviews.slice(0, 5).map((r) => (
              <View key={r.id} style={s.reviewCard}>
                <View style={s.reviewHeader}>
                  <View style={{ flexDirection: "row", gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons key={n} name={n <= r.rating ? "star" : "star-outline"} size={12} color={COLORS.warning} />
                    ))}
                  </View>
                  <Text style={s.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                </View>
                {r.comment ? <Text style={s.reviewComment}>{r.comment}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* Placeholder for non-platform providers with no reviews */}
        {isFirestoreOrScraped && profile.reviews?.length === 0 && (
          <View style={s.section}>
            <View style={s.noReviewsCard}>
              <Ionicons name="star-outline" size={28} color={COLORS.textMuted} />
              <Text style={s.noReviewsText}>No reviews yet</Text>
              <Text style={s.noReviewsSub}>Be the first to review after your booking</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky CTA bar ── */}
      <View style={s.ctaBar}>
        <TouchableOpacity style={s.messageBtn} onPress={handleMessage} activeOpacity={0.85}>
          <Ionicons name="chatbubble-outline" size={17} color={COLORS.primary} />
          <Text style={s.messageBtnText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.bookBtn}
          activeOpacity={0.85}
          onPress={() => { setBooked(false); setAddress(""); setOfferedPrice(""); setBookingDate(todayStr); setSelectedSlot(TIME_SLOTS[0]); setShowBooking(true); }}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.violet]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.bookBtnGrad}
          >
            <Ionicons name="calendar-outline" size={17} color="#fff" />
            <Text style={s.bookBtnText}>Book Now</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Booking Modal ── */}
      <Modal visible={showBooking} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowBooking(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable style={bm.overlay} onPress={() => setShowBooking(false)} />
          <View style={bm.sheet}>
            <View style={bm.handle} />

            {booked ? (
              /* ── Success state ── */
              <View style={bm.successBox}>
                <View style={bm.successIcon}>
                  <Ionicons name="checkmark-circle" size={52} color={COLORS.success} />
                </View>
                <Text style={bm.successTitle}>Booking Request Sent!</Text>
                <Text style={bm.successSub}>
                  {profile.business_name} has received your request and will confirm or decline it shortly.
                </Text>
                <TouchableOpacity style={bm.doneBtn} onPress={() => setShowBooking(false)} activeOpacity={0.85}>
                  <Text style={bm.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Header */}
                <View style={bm.header}>
                  <View>
                    <Text style={bm.title}>Book {profile.business_name}</Text>
                    <Text style={bm.subtitle}>{profile.category} · {profile.city}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowBooking(false)} style={bm.closeBtn}>
                    <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Date */}
                <Text style={bm.sectionLabel}>Date</Text>
                <View style={bm.dateRow}>
                  {[{ label: "Today", value: todayStr }, { label: "Tomorrow", value: tomorrowStr }].map((d) => (
                    <TouchableOpacity
                      key={d.value}
                      style={[bm.datePill, bookingDate === d.value && bm.datePillActive]}
                      onPress={() => setBookingDate(d.value)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={14} color={bookingDate === d.value ? COLORS.primary : COLORS.textMuted} />
                      <Text style={[bm.datePillText, bookingDate === d.value && { color: COLORS.primary }]}>{d.label}</Text>
                      <Text style={bm.dateSub}>{d.value.split("-").reverse().join("/")}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Time Slot */}
                <Text style={bm.sectionLabel}>Time Slot</Text>
                <View style={bm.slotsGrid}>
                  {TIME_SLOTS.map((slot) => {
                    const active = selectedSlot.id === slot.id;
                    return (
                      <TouchableOpacity
                        key={slot.id}
                        style={[bm.slotCard, active && bm.slotCardActive]}
                        onPress={() => setSelectedSlot(slot)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={slot.icon} size={16} color={active ? COLORS.primary : COLORS.textMuted} />
                        <Text style={[bm.slotSub, active && { color: COLORS.primary }]}>{slot.sub}</Text>
                        <Text style={[bm.slotTime, active && { color: COLORS.text }]} numberOfLines={1}>{slot.label}</Text>
                        {active && <View style={bm.slotCheck}><Ionicons name="checkmark" size={9} color="#fff" /></View>}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Address */}
                <Text style={bm.sectionLabel}>Your Address</Text>
                <TextInput
                  style={bm.addressInput}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="e.g. House 12, Street 4, DHA, Lahore"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />

                {/* Price */}
                <Text style={bm.sectionLabel}>Offered Price</Text>
                <View style={bm.priceRow}>
                  <Text style={bm.pricePrefix}>₨</Text>
                  <TextInput
                    style={bm.priceInput}
                    value={offeredPrice}
                    onChangeText={setOfferedPrice}
                    keyboardType="numeric"
                    placeholder={(profile.price_range?.min || 500).toString()}
                    placeholderTextColor={COLORS.textMuted}
                  />
                  {(profile.price_range?.min > 0 || profile.price_range?.max > 0) && (
                    <Text style={bm.priceHint}>
                      Range: ₨{profile.price_range?.min?.toLocaleString() || 0} – ₨{profile.price_range?.max?.toLocaleString() || 0}
                    </Text>
                  )}
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[bm.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleDirectBook}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={[COLORS.success, "#0AA070"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={bm.submitGrad}>
                    {submitting
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={bm.submitText}>Send Booking Request</Text></>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={bm.disclaimer}>
                  This sends a PENDING request to {profile.business_name}. They will accept or decline it.
                </Text>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  emptySub:   { fontSize: 13, color: COLORS.textMuted },
  goBackBtn:  { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary + "44" },
  goBackText: { color: COLORS.primary, fontWeight: "700" },

  hero: { alignItems: "center", paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20, gap: 8, position: "relative" },
  backBtn: { position: "absolute", top: 12, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface + "CC", alignItems: "center", justifyContent: "center" },
  backBtnAbsolute: { position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", zIndex: 10 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary + "20", borderWidth: 2, borderColor: COLORS.primary + "44", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  bizName:  { fontSize: 22, fontWeight: "900", color: COLORS.text, letterSpacing: -0.4 },
  category: { fontSize: 13, color: COLORS.textSecondary, textTransform: "capitalize" },
  sourceBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.violet + "14", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.violet + "33", marginTop: 4 },
  sourceBadgeText: { fontSize: 10, color: COLORS.violet, fontWeight: "700" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 },
  statCard:  { flex: 1, minWidth: "40%", backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 12, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  statLabel: { fontSize: 10, color: COLORS.textMuted },

  section:      { padding: 16, paddingTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginBottom: 10 },
  bioText:      { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },

  contactRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  contactText: { fontSize: 14, color: COLORS.text, fontWeight: "600" },

  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { backgroundColor: COLORS.primary + "14", borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.primary + "30" },
  pillText: { fontSize: 12, color: COLORS.primary, fontWeight: "600" },

  serviceCard:    { flexDirection: "row", backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 8, gap: 8, alignItems: "center" },
  serviceName:    { fontSize: 14, fontWeight: "700", color: COLORS.text },
  serviceDesc:    { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  servicePrice:   { fontSize: 14, fontWeight: "800", color: COLORS.success },
  serviceDuration:{ fontSize: 11, color: COLORS.textMuted },

  availGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  availDay:     { borderRadius: RADIUS.sm, padding: 8, alignItems: "center", minWidth: 44, borderWidth: 1 },
  availDayOn:   { backgroundColor: COLORS.primary + "14", borderColor: COLORS.primary + "30" },
  availDayOff:  { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  availDayText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },
  availTime:    { fontSize: 9, color: COLORS.textMuted, marginTop: 2 },

  reviewCard:   { backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 8 },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  reviewDate:   { fontSize: 11, color: COLORS.textMuted },
  reviewComment:{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },

  noReviewsCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: 20, alignItems: "center", gap: 8 },
  noReviewsText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  noReviewsSub:  { fontSize: 12, color: COLORS.textMuted, textAlign: "center" },

  ctaBar:      { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 10, padding: 16, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  messageBtn:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14, borderRadius: 13, borderWidth: 1, borderColor: COLORS.primary + "44", backgroundColor: COLORS.primary + "0A" },
  messageBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  bookBtn:     { flex: 1.5, borderRadius: 13, overflow: "hidden" },
  bookBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14 },
  bookBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
});

// ── Booking modal styles ──────────────────────────────────────────────────────
const bm = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "92%",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  title:  { fontSize: 18, fontWeight: "900", color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },

  sectionLabel: { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },

  dateRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  datePill: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 12 },
  datePillActive: { borderColor: COLORS.primary + "55", backgroundColor: COLORS.primary + "0E" },
  datePillText: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  dateSub: { fontSize: 10, color: COLORS.textMuted, marginLeft: "auto" },

  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  slotCard: { width: "47%", backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 12, alignItems: "center", gap: 3, position: "relative" },
  slotCardActive: { borderColor: COLORS.primary + "55", backgroundColor: COLORS.primary + "0E" },
  slotSub:  { fontSize: 11, fontWeight: "600", color: COLORS.textMuted },
  slotTime: { fontSize: 10, color: COLORS.textMuted, textAlign: "center" },
  slotCheck: { position: "absolute", top: 7, right: 7, width: 15, height: 15, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },

  addressInput: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 14, fontSize: 14, color: COLORS.text, minHeight: 64, textAlignVertical: "top", marginBottom: 18 },

  priceRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 22 },
  pricePrefix: { fontSize: 20, fontWeight: "800", color: COLORS.success },
  priceInput: { fontSize: 20, fontWeight: "800", color: COLORS.success, borderBottomWidth: 1, borderBottomColor: COLORS.border, minWidth: 80, paddingVertical: 4 },
  priceHint:  { fontSize: 11, color: COLORS.textMuted, flex: 1, textAlign: "right" },

  submitBtn:  { borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  submitGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
  submitText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  disclaimer: { fontSize: 11, color: COLORS.textMuted, textAlign: "center", lineHeight: 16 },

  successBox:   { alignItems: "center", paddingVertical: 32, gap: 12 },
  successIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.successGlow, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.success + "44" },
  successTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  successSub:   { fontSize: 13, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },
  doneBtn:      { marginTop: 8, paddingHorizontal: 40, paddingVertical: 14, borderRadius: 14, backgroundColor: COLORS.success },
  doneBtnText:  { color: "#fff", fontSize: 15, fontWeight: "800" },
});
