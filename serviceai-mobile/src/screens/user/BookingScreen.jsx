import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { API } from "../../services/api";
import { COLORS, FONTS, RADIUS, SHADOWS } from "../../constants/theme";

const TIME_SLOTS = [
  { id: "morning", label: "09:00 – 11:00 AM", icon: "sunny-outline", sub: "Morning" },
  { id: "midday", label: "11:00 AM – 1:00 PM", icon: "partly-sunny-outline", sub: "Midday" },
  { id: "afternoon", label: "02:00 – 04:00 PM", icon: "cloud-outline", sub: "Afternoon" },
  { id: "evening", label: "04:00 – 06:00 PM", icon: "moon-outline", sub: "Evening" },
];

export default function BookingScreen({ route, navigation }) {
  const { provider: rankedProvider, intent } = route.params;
  const { userProfile } = useAuth();
  const p = rankedProvider.provider;

  const [selectedSlot, setSelectedSlot] = useState(TIME_SLOTS[0]);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookedSlots, setBookedSlots] = useState([]);

  useEffect(() => {
    const date = intent?.date || new Date().toISOString().split("T")[0];
    API.getBookedSlots(p.id, date)
      .then((slots) => setBookedSlots(slots))
      .catch(() => {}); // fail silently — slots just won't be greyed out
  }, []);

  async function handleBook() {
    if (!address.trim()) {
      Alert.alert("Address Required", "Please enter your complete address.");
      return;
    }
    setLoading(true);
    try {
      const bookingPayload = {
        provider_id: p.id,
        provider_name: p.name,
        service_category: p.category,
        user_name: userProfile?.name || "Guest User",
        location_address: address.trim(),
        date: intent?.date || new Date().toISOString().split("T")[0],
        time_slot: selectedSlot.label,
        price_agreed: p.price_min,
      };

      // Step 1: create the booking (critical — must succeed)
      const confirmation = await API.book(bookingPayload, p.phone);

      // Step 2: schedule follow-ups (non-critical — ConfirmationScreen fetches from DB anyway)
      let followups = null;
      try {
        followups = await API.scheduleFollowups(confirmation);
      } catch (_) {
        // silently ignored; ConfirmationScreen will load follow-ups from DB via getFollowups()
      }

      navigation.navigate("Confirmation", { confirmation, followups, provider: p });
    } catch (e) {
      Alert.alert("Booking Failed", "Could not connect to the server.\n" + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* Provider Summary Card */}
          <LinearGradient colors={["#12123A", "#0D0D28"]} style={styles.providerCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.providerRow}>
              <LinearGradient colors={[COLORS.primary, "#8B5CF6"]} style={styles.avatar}>
                <Text style={styles.avatarText}>{p.name[0]}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.providerName}>{p.name}</Text>
                <View style={styles.providerMeta}>
                  <Ionicons name="star" size={12} color={COLORS.warning} />
                  <Text style={styles.providerMetaText}>{p.rating} · {p.review_count} reviews</Text>
                </View>
                <Text style={styles.providerArea}>
                  <Ionicons name="location-outline" size={11} color={COLORS.textMuted} /> {p.area}, {p.city}
                </Text>
              </View>
              {p.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={14} color={COLORS.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Price Range</Text>
              <Text style={styles.priceValue}>₨{p.price_min.toLocaleString()} – ₨{p.price_max.toLocaleString()}</Text>
            </View>
          </LinearGradient>

          {/* Date */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Date</Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar" size={18} color={COLORS.primary} />
              <Text style={styles.dateText}>{intent?.date || new Date().toISOString().split("T")[0]}</Text>
              <View style={styles.confirmedBadge}>
                <Text style={styles.confirmedText}>Confirmed</Text>
              </View>
            </View>
          </View>

          {/* Time Slots */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time Slot</Text>
            <View style={styles.slotsGrid}>
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedSlot.id === slot.id;
                const isBooked = bookedSlots.includes(slot.label);
                return (
                  <Pressable
                    key={slot.id}
                    style={[
                      styles.slotCard,
                      isSelected && !isBooked && styles.slotCardActive,
                      isBooked && styles.slotCardBooked,
                    ]}
                    onPress={() => !isBooked && setSelectedSlot(slot)}
                    disabled={isBooked}
                  >
                    <Ionicons
                      name={isBooked ? "close-circle-outline" : slot.icon}
                      size={18}
                      color={isBooked ? COLORS.danger : isSelected ? COLORS.primary : COLORS.textMuted}
                    />
                    <Text style={[styles.slotSub, isSelected && !isBooked && styles.slotSubActive, isBooked && styles.slotSubBooked]}>
                      {slot.sub}
                    </Text>
                    <Text style={[styles.slotTime, isSelected && !isBooked && styles.slotTimeActive]} numberOfLines={1}>
                      {slot.label}
                    </Text>
                    {isBooked && (
                      <View style={styles.slotBookedBadge}>
                        <Text style={styles.slotBookedText}>Booked</Text>
                      </View>
                    )}
                    {isSelected && !isBooked && (
                      <View style={styles.slotCheck}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Address</Text>
            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. House 45, Block 7, Gulshan-e-Iqbal, Karachi"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              color={COLORS.text}
            />
          </View>

          {/* Summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            {[
              ["Service", p.category.replace(/_/g, " ")],
              ["Provider", p.name],
              ["Time", selectedSlot.label],
            ].map(([label, val]) => (
              <View key={label} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{label}</Text>
                <Text style={styles.summaryVal}>{val}</Text>
              </View>
            ))}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Agreed Price</Text>
              <Text style={styles.totalValue}>₨{p.price_min.toLocaleString()}</Text>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.bookBtn, loading && styles.bookBtnDisabled]}
            onPress={handleBook}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#10D9A0", "#0CB888"]} style={styles.bookBtnGrad}>
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.bookBtnText}>Creating Booking...</Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.bookBtnText}>Confirm Booking</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By confirming, you agree to the service terms. The provider will be notified immediately.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 40 },

  providerCard: {
    borderRadius: RADIUS.xl,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.primary + "33",
    ...SHADOWS.glow,
  },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 22, ...FONTS.bold },
  providerName: { fontSize: 16, ...FONTS.bold, color: COLORS.text, marginBottom: 4 },
  providerMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  providerMetaText: { fontSize: 12, color: COLORS.textSecondary },
  providerArea: { fontSize: 12, color: COLORS.textMuted },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.successGlow,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.success + "44",
  },
  verifiedText: { fontSize: 10, color: COLORS.success, ...FONTS.semiBold },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: RADIUS.md,
    padding: 10,
  },
  priceLabel: { fontSize: 12, color: COLORS.textMuted },
  priceValue: { fontSize: 14, ...FONTS.semiBold, color: COLORS.success },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    ...FONTS.bold,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateText: { flex: 1, fontSize: 15, ...FONTS.semiBold, color: COLORS.text },
  confirmedBadge: {
    backgroundColor: COLORS.successGlow,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.success + "44",
  },
  confirmedText: { fontSize: 11, color: COLORS.success, ...FONTS.semiBold },

  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slotCard: {
    width: "47%",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
    position: "relative",
  },
  slotCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryGlow,
  },
  slotCardBooked: {
    borderColor: COLORS.danger + "44",
    backgroundColor: COLORS.dangerGlow,
    opacity: 0.65,
  },
  slotSub: { fontSize: 12, color: COLORS.textMuted, ...FONTS.medium },
  slotSubActive: { color: COLORS.primary },
  slotSubBooked: { color: COLORS.danger },
  slotTime: { fontSize: 10, color: COLORS.textMuted, textAlign: "center" },
  slotTimeActive: { color: COLORS.text },
  slotCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  slotBookedBadge: {
    backgroundColor: COLORS.dangerGlow,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.danger + "44",
  },
  slotBookedText: { fontSize: 9, color: COLORS.danger, ...FONTS.semiBold },

  addressInput: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    lineHeight: 22,
    minHeight: 70,
  },

  summary: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: { fontSize: 12, ...FONTS.bold, color: COLORS.text, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  summaryLabel: { fontSize: 13, color: COLORS.textSecondary },
  summaryVal: { fontSize: 13, ...FONTS.medium, color: COLORS.text },
  summaryDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  totalLabel: { fontSize: 15, ...FONTS.semiBold, color: COLORS.text },
  totalValue: { fontSize: 22, ...FONTS.extraBold, color: COLORS.success },

  bookBtn: { borderRadius: RADIUS.lg, overflow: "hidden", marginBottom: 14, ...SHADOWS.glowSuccess },
  bookBtnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  bookBtnGrad: { paddingVertical: 16, alignItems: "center", borderRadius: RADIUS.lg },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  bookBtnText: { color: "#fff", fontSize: 16, ...FONTS.semiBold },

  disclaimer: { fontSize: 11, color: COLORS.textMuted, textAlign: "center", lineHeight: 17 },
});
