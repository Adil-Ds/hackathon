import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { API } from "../../services/api";
import { COLORS, FONTS, RADIUS } from "../../constants/theme";
import { StatusBadge } from "../../components/ui/Badge";
import { SkeletonCard } from "../../components/ui/Skeleton";

function BookingCard({ booking, onCancel }) {
  const canCancel = booking.status === "PENDING";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.service}>{booking.service}</Text>
          <Text style={styles.provider}>{booking.provider_name}</Text>
          <Text style={styles.bookingId}>#{booking.id}</Text>
        </View>
        <StatusBadge status={booking.status} />
      </View>

      <View style={styles.divider} />

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.metaText}>{booking.date}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.metaText}>{booking.time_slot?.split("–")[0]?.trim()}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="cash-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.metaText}>₨{booking.price_agreed?.toLocaleString()}</Text>
        </View>
      </View>

      {booking.location_address ? (
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.addressText} numberOfLines={1}>{booking.location_address}</Text>
        </View>
      ) : null}

      {canCancel && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => onCancel(booking.id)}
          activeOpacity={0.8}
        >
          <Ionicons name="close-circle-outline" size={14} color={COLORS.danger} />
          <Text style={styles.cancelBtnText}>Cancel Booking</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const FILTERS = [
  { key: "ALL",       label: "All" },
  { key: "PENDING",   label: "Pending" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "CANCELLED", label: "Cancelled" },
];

const FILTER_COLORS = {
  ALL:       COLORS.primary,
  PENDING:   COLORS.warning,
  CONFIRMED: COLORS.success,
  CANCELLED: COLORS.danger,
};

export default function BookingHistoryScreen() {
  const [bookings,   setBookings]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState("ALL");
  const [cancelling, setCancelling] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await API.getAllBookings();
      setBookings(data);
    } catch (_) {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const handleCancel = (bookingId) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking? This action cannot be undone.",
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setCancelling(bookingId);
            try {
              await API.updateBookingStatus(bookingId, "CANCELLED");
              setBookings((prev) =>
                prev.map((b) => b.id === bookingId ? { ...b, status: "CANCELLED" } : b)
              );
            } catch (e) {
              Alert.alert("Error", "Could not cancel booking. Please try again.\n" + e.message);
            } finally {
              setCancelling(null);
            }
          },
        },
      ]
    );
  };

  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;
  const pending   = bookings.filter((b) => b.status === "PENDING").length;

  const displayed = filter === "ALL"
    ? bookings
    : bookings.filter((b) => b.status === filter);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
        <Text style={styles.subtitle}>{bookings.length} total · {confirmed} confirmed · {pending} pending</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const color  = FILTER_COLORS[f.key];
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterTab, active && { backgroundColor: color + "20", borderColor: color + "66" }]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, active && { color }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={{ padding: 16 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onCancel={handleCancel}
              cancelling={cancelling === item.id}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={52} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>
                {filter === "ALL" ? "No bookings yet" : `No ${filter.toLowerCase()} bookings`}
              </Text>
              <Text style={styles.emptySub}>
                {filter === "ALL" ? "Book a service from the Home tab" : "Try a different filter"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 20, paddingBottom: 10 },
  title:    { fontSize: 26, ...FONTS.extraBold, color: COLORS.text, marginBottom: 3 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary },

  filterRow: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  filterTabText: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },

  list: { padding: 16, paddingTop: 8, paddingBottom: 48 },
  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardTop:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  service:    { fontSize: 15, ...FONTS.bold, color: COLORS.text, marginBottom: 3 },
  provider:   { fontSize: 13, color: COLORS.textSecondary, marginBottom: 3 },
  bookingId:  { fontSize: 11, color: COLORS.textMuted },
  divider:    { height: 1, backgroundColor: COLORS.border, marginBottom: 10 },
  metaRow:    { flexDirection: "row", gap: 16, marginBottom: 8 },
  metaItem:   { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText:   { fontSize: 12, color: COLORS.textSecondary },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  addressText: { fontSize: 12, color: COLORS.textMuted, flex: 1 },

  cancelBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 12, paddingVertical: 9,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.danger + "44",
    backgroundColor: COLORS.dangerGlow,
  },
  cancelBtnText: { fontSize: 13, color: COLORS.danger, ...FONTS.semiBold },

  empty:      { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  emptySub:   { fontSize: 13, color: COLORS.textMuted },
});
