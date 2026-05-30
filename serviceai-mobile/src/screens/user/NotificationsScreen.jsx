/**
 * Realtime Notifications Screen
 * Merges v1 booking-derived notifications (SQLite) with v2 server notifications (PG).
 * Live updates arrive via WebSocket → notificationStore.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList, RefreshControl, StyleSheet, Text,
  TouchableOpacity, View, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { API } from "../../services/api";
import { ChatAPI } from "../../services/chatApi";
import { useNotificationStore } from "../../stores/notificationStore";
import { COLORS, FONTS, RADIUS } from "../../constants/theme";

// ── Notification type meta ────────────────────────────────────────────────────
const N_META = {
  BOOKING_CREATED:   { icon: "add-circle-outline",    color: COLORS.primary,  label: "New Booking" },
  BOOKING_CONFIRMED: { icon: "checkmark-circle",       color: COLORS.success,  label: "Confirmed" },
  BOOKING_CANCELLED: { icon: "close-circle-outline",   color: COLORS.danger,   label: "Cancelled" },
  NEW_MESSAGE:       { icon: "chatbubble-outline",     color: COLORS.violet,   label: "Message" },
  CALL_INCOMING:     { icon: "call-outline",           color: COLORS.warning,  label: "Call" },
  REVIEW_RECEIVED:   { icon: "star-outline",           color: COLORS.warning,  label: "Review" },
  SYSTEM:            { icon: "information-circle-outline", color: COLORS.info, label: "System" },
  // v1 legacy
  PENDING:           { icon: "time-outline",            color: COLORS.warning,  label: "Pending" },
  CONFIRMED:         { icon: "checkmark-circle-outline",color: COLORS.success,  label: "Confirmed" },
  CANCELLED:         { icon: "close-circle-outline",   color: COLORS.danger,   label: "Cancelled" },
  REMINDER:          { icon: "alarm-outline",           color: COLORS.primary,  label: "Reminder" },
  DEFAULT:           { icon: "receipt-outline",         color: COLORS.info,     label: "Update" },
};

function getMeta(type) {
  return N_META[type] || N_META.DEFAULT;
}

function timeAgo(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000)      return "Just now";
  if (ms < 3_600_000)   return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000)  return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Build v1 booking notifications ───────────────────────────────────────────
function buildV1Notifications(bookings) {
  return bookings.map((b) => ({
    id: `v1_${b.id || b.booking_id}`,
    type: b.status || "DEFAULT",
    title: `${b.service || "Service"} — ${b.status || "Update"}`,
    body: `Provider: ${b.provider_name}`,
    is_read: true,
    created_at: b.created_at,
    _source: "v1",
  }));
}

// ── Notification Item ─────────────────────────────────────────────────────────
function NotifItem({ item, onPress, onMarkRead }) {
  const meta = getMeta(item.type);
  return (
    <TouchableOpacity
      style={[ni.row, !item.is_read && ni.rowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[ni.iconWrap, { backgroundColor: meta.color + "18" }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={ni.body}>
        <View style={ni.headerRow}>
          <Text style={ni.title} numberOfLines={1}>{item.title}</Text>
          <Text style={ni.time}>{timeAgo(item.created_at)}</Text>
        </View>
        <Text style={ni.bodyText} numberOfLines={2}>{item.body}</Text>
      </View>
      {!item.is_read && (
        <TouchableOpacity style={ni.dotBtn} onPress={onMarkRead} activeOpacity={0.8}>
          <View style={[ni.dot, { backgroundColor: meta.color }]} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NotificationsScreen({ navigation }) {
  const { user, userProfile }                             = useAuth();
  const { notifications, setNotifications, markRead, markAllRead, unreadCount } =
    useNotificationStore();
  const [loading,    setLoading]                          = useState(true);
  const [refreshing, setRefreshing]                       = useState(false);

  const load = useCallback(async () => {
    try {
      // Try v2 notifications
      let v2Notifs = [];
      try {
        v2Notifs = await ChatAPI.listNotifications();
      } catch (_) {}

      // Merge with v1 booking notifications
      let v1Notifs = [];
      try {
        const bookings = await API.getAllBookings(userProfile?.uid || user?.uid);
        v1Notifs = buildV1Notifications(bookings);
      } catch (_) {}

      // Deduplicate & merge by id
      const seen  = new Set(v2Notifs.map((n) => n.id));
      const all   = [...v2Notifs, ...v1Notifs.filter((n) => !seen.has(n.id))];
      // Sort by time desc
      all.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setNotifications(all);
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, userProfile]);

  useEffect(() => { load(); }, []);

  const handleMarkAllRead = async () => {
    markAllRead();
    try { await ChatAPI.markAllNotificationsRead(); } catch (_) {}
  };

  const handleMarkOne = async (id) => {
    markRead(id);
    if (!id.startsWith("v1_")) {
      try { await ChatAPI.markNotificationRead(id); } catch (_) {}
    }
  };

  const handlePress = (item) => {
    handleMarkOne(item.id);
    if (item.type === "NEW_MESSAGE") {
      navigation.navigate("ChatTab");
    } else if (["BOOKING_CREATED","BOOKING_CONFIRMED","BOOKING_CANCELLED","PENDING","CONFIRMED","CANCELLED"].includes(item.type)) {
      navigation.navigate("BookingsTab");
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity style={s.markAllBtn} onPress={handleMarkAllRead} activeOpacity={0.75}>
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {unreadCount > 0 && (
        <View style={s.unreadRow}>
          <Ionicons name="ellipse" size={8} color={COLORS.primary} />
          <Text style={s.unreadText}>{unreadCount} unread</Text>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <NotifItem
            item={item}
            onPress={() => handlePress(item)}
            onMarkRead={() => handleMarkOne(item.id)}
          />
        )}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          !loading && (
            <View style={s.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={COLORS.textMuted} />
              <Text style={s.emptyTitle}>No notifications yet</Text>
              <Text style={s.emptySub}>Booking updates will appear here</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.text, flex: 1, letterSpacing: -0.5 },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary + "44" },
  markAllText: { fontSize: 12, color: COLORS.primary, fontWeight: "700" },
  unreadRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, marginBottom: 6 },
  unreadText: { fontSize: 12, color: COLORS.primary, fontWeight: "600" },
  list: { padding: 8, paddingBottom: 40 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textMuted },
});

const ni = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 14, marginVertical: 3, marginHorizontal: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  rowUnread: { borderColor: COLORS.primary + "33", backgroundColor: COLORS.primary + "06" },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  body: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontSize: 13, fontWeight: "700", color: COLORS.text, flex: 1 },
  time: { fontSize: 10, color: COLORS.textMuted },
  bodyText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  dotBtn: { alignSelf: "center", padding: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
