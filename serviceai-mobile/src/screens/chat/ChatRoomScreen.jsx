import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ChatAPI } from "../../services/chatApi";
import { wsManager } from "../../services/websocket";
import { useChatStore } from "../../stores/chatStore";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS, FONTS } from "../../constants/theme";

// ── Pakistan Standard Time helpers (UTC+5, Asia/Karachi) ─────────────────────
const PKT = "Asia/Karachi";

/**
 * Parse an ISO string as UTC.
 * Python's datetime.utcnow().isoformat() omits the "Z" suffix, which makes
 * browsers treat the value as local time instead of UTC. Appending "Z" fixes that.
 */
function parseUTC(isoStr) {
  if (!isoStr) return new Date();
  return new Date(/[Z+]/.test(isoStr) ? isoStr : isoStr + "Z");
}

function pktDateKey(isoStr) {
  return new Intl.DateTimeFormat("en-US", { timeZone: PKT, year: "numeric", month: "2-digit", day: "2-digit" }).format(parseUTC(isoStr));
}

function pktTime(isoStr) {
  return parseUTC(isoStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: PKT, hour12: true });
}

function formatSendTime(isoStr) {
  if (!isoStr) return "";
  const d      = parseUTC(isoStr);
  const now    = new Date();
  const timeStr = pktTime(isoStr);
  const diffMs  = now - d;

  if (pktDateKey(d) === pktDateKey(now)) return timeStr;

  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (pktDateKey(d) === pktDateKey(yest)) return `Yesterday ${timeStr}`;

  if (diffMs < 604_800_000) {
    return `${d.toLocaleDateString("en-US", { weekday: "short", timeZone: PKT })} ${timeStr}`;
  }

  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PKT })} ${timeStr}`;
}

function isSameDay(isoA, isoB) {
  if (!isoA || !isoB) return false;
  return pktDateKey(isoA) === pktDateKey(isoB);
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, isOwn }) {
  const text    = msg.decryptedText ?? msg.encrypted_payload ?? "";
  const timeStr = formatSendTime(msg.created_at);
  const failed  = msg.deliveryStatus === "failed";
  const isSend  = msg.deliveryStatus === "sending";

  if (isOwn) {
    return (
      <View style={[b.wrap, b.right]}>
        <LinearGradient
          colors={failed ? [COLORS.danger + "88", COLORS.danger + "66"] : [COLORS.primary, COLORS.violet]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[b.bubble, b.ownBubble]}
        >
          <Text style={b.ownText}>{text}</Text>
          <View style={b.metaRow}>
            <Text style={b.ownTime}>{timeStr}</Text>
            {failed  ? <Ionicons name="alert-circle-outline" size={12} color="#fff" />
             : isSend ? <ActivityIndicator size={10} color="rgba(255,255,255,0.7)" />
             : <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.7)" />}
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[b.wrap, b.left]}>
      <View style={[b.bubble, b.otherBubble]}>
        <Text style={b.otherText}>{text}</Text>
        <Text style={b.otherTime}>{timeStr}</Text>
      </View>
    </View>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots({ conversationId }) {
  const isTyping = useChatStore((st) => {
    const set = st.typingUsers[conversationId];
    return set ? set.size > 0 : false;
  });
  if (!isTyping) return null;
  return (
    <View style={t.row}>
      {[0, 1, 2].map(i => <View key={i} style={[t.dot, { opacity: 0.3 + i * 0.25 }]} />)}
      <Text style={t.label}>typing…</Text>
    </View>
  );
}

// ── Date separator ────────────────────────────────────────────────────────────
function DateSep({ isoDate }) {
  const d    = parseUTC(isoDate);
  const now  = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);

  let label;
  if (pktDateKey(d) === pktDateKey(now))       label = "Today";
  else if (pktDateKey(d) === pktDateKey(yest)) label = "Yesterday";
  else if (now - d < 604_800_000)              label = d.toLocaleDateString("en-US", { weekday: "long", timeZone: PKT });
  else label = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: PKT });

  return (
    <View style={ds.row}>
      <Text style={ds.text}>{label}</Text>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyChat({ otherName }) {
  return (
    <View style={ec.wrap}>
      <View style={ec.iconWrap}>
        <Ionicons name="chatbubbles-outline" size={48} color={COLORS.primary} />
      </View>
      <Text style={ec.title}>Start the conversation</Text>
      <Text style={ec.sub}>
        {otherName ? `Say hello to ${otherName}!` : "Send your first message below"}
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ChatRoomScreen({ route, navigation }) {
  const { conversation }  = route.params ?? {};
  const { user, userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { messages, setMessages, appendMessage, insertOptimistic, removeOptimistic } = useChatStore();

  const isNew = Boolean(conversation?.id?.startsWith("new_"));

  const [realConvId, setRealConvId] = useState(isNew ? null : conversation?.id ?? null);
  const [text,    setText]    = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [sending, setSending] = useState(false);

  const flatRef     = useRef(null);
  const typingTimer = useRef(null);

  const convId = realConvId ?? conversation?.id ?? "";
  const msgs   = messages[convId] || [];

  // ── Resolve the other person's display name ───────────────────────────────
  const otherName =
    conversation?.other_participant_name     // from API (inbox navigation)
    || conversation?._providerInfo?.business_name
    || conversation?._providerInfo?.name
    || null;

  // ── Set header title BEFORE first render with useLayoutEffect ────────────
  useLayoutEffect(() => {
    navigation.setOptions({
      title: otherName || "Chat",
      headerStyle: { backgroundColor: COLORS.surface ?? "#1a1a2e" },
      headerBackTitle: "Chats",
    });
  }, [otherName]);

  // ── WS subscribe + mark read ──────────────────────────────────────────────
  useEffect(() => {
    if (!realConvId) return;
    wsManager.subscribeConversation(realConvId);
    ChatAPI.markRead(realConvId).catch(() => {});
    useChatStore.getState().resetUnread(realConvId);
  }, [realConvId]);

  // ── Load messages (plain text) ────────────────────────────────────────────
  const loadMessages = useCallback(async (id) => {
    if (!id || id.startsWith("new_")) { setLoading(false); return; }
    try {
      const raw  = await ChatAPI.getMessages(id);
      const list = raw.map(m => ({ ...m, decryptedText: m.encrypted_payload }));
      setMessages(id, list);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMessages(realConvId); }, [realConvId]);

  // ── Polling — real-time fallback (every 3 s, like WhatsApp) ──────────────
  useEffect(() => {
    if (!realConvId) return;
    const poll = async () => {
      try {
        const raw  = await ChatAPI.getMessages(realConvId);
        const list = raw.map(m => ({ ...m, decryptedText: m.encrypted_payload }));
        const cur  = useChatStore.getState().messages[realConvId] || [];
        // Only update store if server has messages we don't have yet
        const serverIds = new Set(list.map(m => m.id));
        const curIds    = new Set(cur.filter(m => !m._optimistic).map(m => m.id));
        const hasNew    = list.some(m => !curIds.has(m.id));
        if (hasNew) {
          // Merge: keep optimistic messages, add all real ones
          const optimistic = cur.filter(m => m._optimistic);
          setMessages(realConvId, [...list, ...optimistic]);
        }
      } catch (_) {}
    };
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [realConvId]);

  // ── Auto-scroll on new message ────────────────────────────────────────────
  useEffect(() => {
    if (msgs.length > 0)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
  }, [msgs.length]);

  // ── Create conversation on first send ─────────────────────────────────────
  const ensureConversation = async () => {
    if (realConvId) return realConvId;

    const myId    = user?.uid;
    const myName  = userProfile?.name || user?.displayName || "User";
    const otherId = conversation?.participant_ids?.find(id => id !== myId)
                 ?? conversation?.participant_ids?.[0];

    const participantNames = {
      ...(myId    ? { [myId]:    myName }         : {}),
      ...(otherId ? { [otherId]: otherName || "" } : {}),
    };

    const conv  = await ChatAPI.createConversation(
      [myId, otherId].filter(Boolean), null, participantNames
    );
    const newId = conv.id;
    setRealConvId(newId);

    // Seed the store with a proper entry so the inbox shows the right name
    // immediately — before any WS echo can create a nameless sparse entry.
    useChatStore.getState().updateConversation({
      ...conv,
      other_participant_name: otherName || null,
      participant_ids: [myId, otherId].filter(Boolean),
    });

    wsManager.subscribeConversation(newId);
    return newId;
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const plain = text.trim();
    if (!plain || sending) return;
    setText("");
    setSending(true);

    const localId    = `opt_${Date.now()}`;
    const optimistic = {
      _optimistic: true, _localId: localId,
      id: localId, conversation_id: convId,
      sender_id: user?.uid ?? "",
      encrypted_payload: plain, decryptedText: plain,
      message_type: "text", is_deleted: false,
      created_at: new Date().toISOString(),
      read_by: [], deliveryStatus: "sending",
    };
    insertOptimistic(convId, optimistic);

    try {
      const activeId = await ensureConversation();
      const sent     = await ChatAPI.sendMessage(activeId, plain);
      appendMessage(activeId, { ...sent, decryptedText: plain, deliveryStatus: "sent", _localId: localId });
      removeOptimistic(convId, localId);
    } catch (_) {
      removeOptimistic(convId, localId);
      insertOptimistic(convId, { ...optimistic, deliveryStatus: "failed" });
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (val) => {
    setText(val);
    if (realConvId) {
      wsManager.sendTypingStart(realConvId);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => wsManager.sendTypingStop(realConvId), 2000);
    }
  };

  // ── Render message ────────────────────────────────────────────────────────
  const renderItem = ({ item, index }) => {
    const isOwn    = item.sender_id === user?.uid;
    const showDate = index === 0 || !isSameDay(msgs[index - 1]?.created_at, item.created_at);
    return (
      <>
        {showDate && <DateSep isoDate={item.created_at} />}
        <Bubble msg={item} isOwn={isOwn} />
      </>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          ref={flatRef}
          data={msgs}
          style={s.list}
          keyExtractor={item => item.id || item._localId}
          renderItem={renderItem}
          contentContainerStyle={[s.listContent, msgs.length === 0 && s.listContentEmpty]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyChat otherName={otherName} />}
        />
      )}

      <TypingDots conversationId={convId} />

      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={handleTyping}
          placeholder="Type a message…"
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnOff]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={17} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: COLORS.bg },
  centered:         { flex: 1, alignItems: "center", justifyContent: "center" },
  list:             { flex: 1, backgroundColor: COLORS.bg },
  listContent:      { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  listContentEmpty: { flex: 1, justifyContent: "center" },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    color: COLORS.text, fontSize: 14, maxHeight: 110,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sendBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sendBtnOff: { backgroundColor: COLORS.border },
});

const b = StyleSheet.create({
  wrap:        { marginBottom: 3 },
  right:       { alignItems: "flex-end" },
  left:        { alignItems: "flex-start" },
  bubble:      { maxWidth: "78%", borderRadius: 18, padding: 11 },
  ownBubble:   { borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderBottomLeftRadius: 4 },
  ownText:     { fontSize: 14, color: "#fff", lineHeight: 20 },
  otherText:   { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  metaRow:     { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  ownTime:     { fontSize: 10, color: "rgba(255,255,255,0.6)" },
  otherTime:   { fontSize: 10, color: COLORS.textMuted, marginTop: 3, textAlign: "right" },
});

const t = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 18, paddingBottom: 4 },
  dot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.textMuted },
  label: { fontSize: 11, color: COLORS.textMuted, fontStyle: "italic" },
});

const ds = StyleSheet.create({
  row:  { alignItems: "center", marginVertical: 10 },
  text: { fontSize: 11, color: COLORS.textMuted, backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: "hidden" },
});

const ec = StyleSheet.create({
  wrap:     { alignItems: "center", gap: 14, paddingVertical: 60 },
  iconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primary + "18", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.primary + "30" },
  title:    { fontSize: 19, fontWeight: "800", color: COLORS.text },
  sub:      { fontSize: 13, color: COLORS.textMuted, textAlign: "center", paddingHorizontal: 40, lineHeight: 19 },
});
