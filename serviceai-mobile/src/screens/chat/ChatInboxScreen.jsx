/**
 * Chat Inbox — WhatsApp-style conversation list.
 *
 * Priority ordering:
 *   1. IN_PROGRESS bookings (pinned, highlighted orange)
 *   2. CONFIRMED booking chats (green accent)
 *   3. Unread conversations (by unread count desc)
 *   4. Last message time (desc)
 */
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  Animated, FlatList, RefreshControl, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ChatAPI } from "../../services/chatApi";
import { useChatStore } from "../../stores/chatStore";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS, FONTS, RADIUS } from "../../constants/theme";

// ── Pakistan Standard Time (UTC+5, Asia/Karachi) ──────────────────────────────
const PKT = "Asia/Karachi";

function parseUTC(isoStr) {
  if (!isoStr) return new Date();
  return new Date(/[Z+]/.test(isoStr) ? isoStr : isoStr + "Z");
}

function pktDateKey(isoStr) {
  return new Intl.DateTimeFormat("en-US", { timeZone: PKT, year: "numeric", month: "2-digit", day: "2-digit" }).format(parseUTC(isoStr));
}

// ── Auto-refreshing "now" so relative times stay accurate ────────────────────
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso, nowMs) {
  if (!iso) return "";
  const d    = parseUTC(iso);
  const ms   = nowMs - d.getTime();
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(ms / 60_000);
  const hrs  = Math.floor(ms / 3_600_000);

  if (secs < 60)   return "just now";
  if (mins < 60)   return `${mins} min ago`;
  if (hrs  < 24)   return `${hrs}h ago`;

  const yest = new Date(nowMs); yest.setDate(yest.getDate() - 1);
  if (pktDateKey(iso) === pktDateKey(yest.toISOString())) return "Yesterday";
  if (ms < 604_800_000) return d.toLocaleDateString("en-US", { weekday: "short", timeZone: PKT });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PKT });
}

function getBookingPriority(conv) {
  const bookingId = conv.booking_id || "";
  const status    = conv.booking_status || "";
  if (status === "IN_PROGRESS")  return 0;
  if (status === "CONFIRMED")    return 1;
  if (status === "PENDING")      return 2;
  return 3;
}

function sortConversations(convs) {
  return [...convs].sort((a, b) => {
    const pa = getBookingPriority(a);
    const pb = getBookingPriority(b);
    if (pa !== pb) return pa - pb;
    // Secondary: unread count desc
    if ((b.unread_count || 0) !== (a.unread_count || 0))
      return (b.unread_count || 0) - (a.unread_count || 0);
    // Tertiary: last message time desc
    return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
  });
}

// ── Conversation Item ─────────────────────────────────────────────────────────
function ConversationItem({ item, currentUserId, isOnline, onPress, nowMs }) {
  const unread         = item.unread_count || 0;
  const bookingStatus  = item.booking_status;
  const isActive       = bookingStatus === "IN_PROGRESS";
  const isConfirmed    = bookingStatus === "CONFIRMED";
  const slideIn        = useRef(new Animated.Value(20)).current;
  const fadeIn         = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideIn, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeIn,  { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const borderColor = isActive
    ? COLORS.warning + "55"
    : isConfirmed
    ? COLORS.success + "44"
    : unread > 0
    ? COLORS.primary + "33"
    : "transparent";

  const bgColor = isActive
    ? COLORS.warning + "08"
    : isConfirmed
    ? COLORS.success + "06"
    : "transparent";

  return (
    <Animated.View
      style={[
        ci.wrap,
        { borderColor, backgroundColor: bgColor },
        { opacity: fadeIn, transform: [{ translateX: slideIn }] },
      ]}
    >
      <TouchableOpacity style={ci.inner} onPress={onPress} activeOpacity={0.72}>
        {/* Avatar */}
        <View style={ci.avatarOuter}>
          <LinearGradient
            colors={
              isActive
                ? [COLORS.warning + "40", COLORS.warning + "20"]
                : [COLORS.primary + "30", COLORS.violet + "20"]
            }
            style={ci.avatar}
          >
            <Ionicons
              name={bookingStatus ? "storefront-outline" : "person-outline"}
              size={20}
              color={isActive ? COLORS.warning : COLORS.primary}
            />
          </LinearGradient>
          {isOnline && <View style={ci.onlineDot} />}
        </View>

        {/* Body */}
        <View style={ci.body}>
          <View style={ci.headerRow}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[ci.name, unread > 0 && { color: COLORS.text }]} numberOfLines={1}>
                {item.other_participant_name
                  || (item.booking_id ? `Booking #${item.booking_id.slice(-6).toUpperCase()}` : "Conversation")}
              </Text>
              {isActive && (
                <View style={ci.activeBadge}>
                  <View style={ci.activePulse} />
                  <Text style={ci.activeBadgeText}>ACTIVE</Text>
                </View>
              )}
              {isConfirmed && !isActive && (
                <View style={ci.confirmedBadge}>
                  <Ionicons name="checkmark-circle" size={10} color={COLORS.success} />
                  <Text style={ci.confirmedBadgeText}>CONFIRMED</Text>
                </View>
              )}
            </View>
            <Text style={ci.time}>{formatTime(item.last_message_at, nowMs)}</Text>
          </View>

          <View style={ci.footerRow}>
            <Text style={[ci.preview, unread > 0 && ci.previewBold]} numberOfLines={1}>
              {item.last_message_preview || "Tap to open"}
            </Text>
            {unread > 0 && (
              <View style={ci.unreadBadge}>
                <Text style={ci.unreadText}>{unread > 99 ? "99+" : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ChatInboxScreen({ navigation }) {
  const { user }                                         = useAuth();
  const { conversations, setConversations, isOnline }    = useChatStore();
  const [loading,    setLoading]                         = useState(true);
  const [refreshing, setRefreshing]                      = useState(false);
  const nowMs                                            = useNow(30_000);

  const sorted = sortConversations(conversations);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await ChatAPI.listConversations();
      setConversations(data);
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, []);

  // Re-fetch whenever the tab/screen comes into focus so newly created
  // conversations (and their proper names) are always pulled from the backend.
  useFocusEffect(useCallback(() => { fetchConversations(); }, [fetchConversations]));

  const activeBookings = sorted.filter((c) => c.booking_status === "IN_PROGRESS");
  const hasActive      = activeBookings.length > 0;

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      {/* Active booking banner */}
      {hasActive && (
        <View style={s.activeBanner}>
          <LinearGradient
            colors={[COLORS.warning + "18", COLORS.warning + "08"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.activeBannerGrad}
          >
            <View style={s.activePulseOuter}>
              <View style={s.activePulseInner} />
            </View>
            <Text style={s.activeBannerText}>
              {activeBookings.length} active job{activeBookings.length > 1 ? "s" : ""} in progress
            </Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.warning} />
          </LinearGradient>
        </View>
      )}

      {/* Conversations */}
      {loading ? (
        <View style={s.skeleton}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={s.skeletonItem}>
              <View style={s.skeletonAvatar} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[s.skeletonLine, { width: "60%" }]} />
                <View style={[s.skeletonLine, { width: "90%" }]} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const otherIds = (item.participant_ids || []).filter((id) => id !== user?.uid);
            const online   = otherIds.some((id) => isOnline(id));
            return (
              <ConversationItem
                item={item}
                currentUserId={user?.uid}
                isOnline={online}
                nowMs={nowMs}
                onPress={() => navigation.navigate("ChatRoom", {
                  conversation: {
                    ...item,
                    _providerInfo: item.other_participant_name
                      ? { business_name: item.other_participant_name }
                      : null,
                  },
                })}
              />
            );
          }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchConversations(); }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={52} color={COLORS.textMuted} />
              <Text style={s.emptyTitle}>No conversations yet</Text>
              <Text style={s.emptySub}>Messages with providers will appear here</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: COLORS.bg },
  activeBanner: { marginHorizontal: 12, marginTop: 8, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: COLORS.warning + "33" },
  activeBannerGrad: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  activePulseOuter: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.warning + "33", alignItems: "center", justifyContent: "center" },
  activePulseInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.warning },
  activeBannerText: { flex: 1, fontSize: 12, fontWeight: "700", color: COLORS.warning },
  list: { padding: 8, paddingBottom: 32 },
  skeleton: { padding: 16, gap: 16 },
  skeletonItem: { flexDirection: "row", gap: 12, alignItems: "center" },
  skeletonAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.surface },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: COLORS.surface },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textMuted },
});

const ci = StyleSheet.create({
  wrap: { borderRadius: 14, marginHorizontal: 8, marginVertical: 4, borderWidth: 1 },
  inner: { flexDirection: "row", gap: 12, alignItems: "center", padding: 12 },
  avatarOuter: { position: "relative" },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  onlineDot: { position: "absolute", bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: COLORS.success, borderWidth: 2, borderColor: COLORS.bg },
  body: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 4 },
  name: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  time: { fontSize: 11, color: COLORS.textMuted },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  preview: { flex: 1, fontSize: 13, color: COLORS.textMuted },
  previewBold: { color: COLORS.text, fontWeight: "600" },
  unreadBadge: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: "center" },
  unreadText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.warning + "18", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.warning + "44" },
  activePulse: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.warning },
  activeBadgeText: { fontSize: 8, fontWeight: "900", color: COLORS.warning, letterSpacing: 0.4 },
  confirmedBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: COLORS.success + "14", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.success + "33" },
  confirmedBadgeText: { fontSize: 8, fontWeight: "800", color: COLORS.success },
});
