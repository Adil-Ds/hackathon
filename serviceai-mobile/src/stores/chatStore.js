import { create } from "zustand";

export const useChatStore = create((set, get) => ({
  // Conversations list
  conversations: [],
  // Messages keyed by conversationId
  messages: {},
  // {conversationId: Set<userId>}
  typingUsers: {},
  // Set<userId>
  onlineUsers: new Set(),
  // Total unread across all conversations
  totalUnread: 0,

  // ── Conversations ──────────────────────────────────────────────────────────

  setConversations: (convs) => {
    const total = convs.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    set({ conversations: convs, totalUnread: total });
  },

  updateConversation: (conv) =>
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === conv.id);
      let next;
      if (idx >= 0) {
        next = [...state.conversations];
        next[idx] = { ...next[idx], ...conv };
      } else {
        next = [conv, ...state.conversations];
      }
      const total = next.reduce((acc, c) => acc + (c.unread_count || 0), 0);
      return { conversations: next, totalUnread: total };
    }),

  decrementUnread: (conversationId) =>
    set((state) => {
      const next = state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, unread_count: Math.max(0, (c.unread_count || 0) - 1) }
          : c
      );
      const total = next.reduce((acc, c) => acc + (c.unread_count || 0), 0);
      return { conversations: next, totalUnread: total };
    }),

  resetUnread: (conversationId) =>
    set((state) => {
      const next = state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      );
      const total = next.reduce((acc, c) => acc + (c.unread_count || 0), 0);
      return { conversations: next, totalUnread: total };
    }),

  // ── Messages ───────────────────────────────────────────────────────────────

  setMessages: (conversationId, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: msgs },
    })),

  appendMessage: (conversationId, msg) =>
    set((state) => {
      const existing = state.messages[conversationId] || [];
      // Remove optimistic duplicate if present
      const filtered = existing.filter(
        (m) => m.id !== msg.id && !(m._optimistic && m._localId === msg._localId)
      );
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...filtered, msg],
        },
      };
    }),

  insertOptimistic: (conversationId, msg) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), msg],
      },
    })),

  removeOptimistic: (conversationId, localId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).filter(
          (m) => !(m._optimistic && m._localId === localId)
        ),
      },
    })),

  updateDeliveryStatus: (conversationId, messageId, status) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, deliveryStatus: status } : m
        ),
      },
    })),

  markReadInStore: (conversationId, userId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m.read_by && !m.read_by.includes(userId)
            ? { ...m, read_by: [...m.read_by, userId] }
            : m
        ),
      },
    })),

  // ── Typing ─────────────────────────────────────────────────────────────────

  addTypingUser: (conversationId, userId) =>
    set((state) => {
      const existing = new Set(state.typingUsers[conversationId] || []);
      existing.add(userId);
      return { typingUsers: { ...state.typingUsers, [conversationId]: existing } };
    }),

  removeTypingUser: (conversationId, userId) =>
    set((state) => {
      const existing = new Set(state.typingUsers[conversationId] || []);
      existing.delete(userId);
      return { typingUsers: { ...state.typingUsers, [conversationId]: existing } };
    }),

  // ── Presence ───────────────────────────────────────────────────────────────

  setUserOnline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.add(userId);
      return { onlineUsers: next };
    }),

  setUserOffline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),

  isOnline: (userId) => get().onlineUsers.has(userId),

  // Helper for components: get a stable boolean via selector
  selectIsOnline: (userId) => (state) => state.onlineUsers.has(userId),
}));
