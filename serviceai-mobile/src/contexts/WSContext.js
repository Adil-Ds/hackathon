import React, { createContext, useContext, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { wsManager } from "../services/websocket";
import { useChatStore } from "../stores/chatStore";
import { useNotificationStore } from "../stores/notificationStore";

const WSContext = createContext(null);

export function WSProvider({ children }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      wsManager.disconnect();
      return;
    }

    user.getIdToken().then((token) => {
      wsManager.connect(token);
    });

    const unsubscribers = [
      // ── New message ──────────────────────────────────────────────────────
      wsManager.on("new_message", (data) => {
        const msg = data.message;
        if (!msg) return;
        const convId = data.conversation_id;

        // Messages are stored as plaintext — use encrypted_payload directly
        const fullMsg = { ...msg, decryptedText: msg.encrypted_payload };

        const { appendMessage, conversations, updateConversation } = useChatStore.getState();
        appendMessage(convId, fullMsg);

        // Update conversation preview + unread count
        const conv = conversations.find((c) => c.id === convId);
        if (msg.sender_id !== user.uid) {
          updateConversation({
            id: convId,
            last_message_at: msg.created_at,
            last_message_preview: msg.encrypted_payload || "New message",
            unread_count: (conv?.unread_count || 0) + 1,
          });
        } else {
          // Own message echoed back — update preview without incrementing unread
          updateConversation({
            id: convId,
            last_message_at: msg.created_at,
            last_message_preview: msg.encrypted_payload,
          });
        }
      }),

      // ── Typing ───────────────────────────────────────────────────────────
      wsManager.on("typing_start", (data) => {
        if (data.user_id === user.uid) return;
        useChatStore.getState().addTypingUser(data.conversation_id, data.user_id);
        // Auto-clear typing after 3 seconds if no typing_stop arrives
        setTimeout(() => {
          useChatStore.getState().removeTypingUser(data.conversation_id, data.user_id);
        }, 3000);
      }),

      wsManager.on("typing_stop", (data) => {
        useChatStore.getState().removeTypingUser(data.conversation_id, data.user_id);
      }),

      // ── Presence ─────────────────────────────────────────────────────────
      wsManager.on("presence_online", (data) => {
        useChatStore.getState().setUserOnline(data.user_id);
      }),
      wsManager.on("presence_offline", (data) => {
        useChatStore.getState().setUserOffline(data.user_id);
      }),

      // ── Read receipts ─────────────────────────────────────────────────────
      wsManager.on("message_read", (data) => {
        if (data.user_id === user.uid) {
          useChatStore.getState().resetUnread(data.conversation_id);
        } else {
          useChatStore.getState().markReadInStore(data.conversation_id, data.user_id);
        }
      }),

      // ── Notifications ─────────────────────────────────────────────────────
      wsManager.on("new_notification", (data) => {
        if (data.notification) {
          useNotificationStore.getState().prependNotification(data.notification);
        }
      }),

      // ── Booking refresh signal ────────────────────────────────────────────
      wsManager.on("booking_update", () => {
        wsManager._emit("__booking_refresh", {});
      }),
    ];

    return () => {
      unsubscribers.forEach((fn) => fn());
      wsManager.disconnect();
    };
  }, [user?.uid]);

  return <WSContext.Provider value={wsManager}>{children}</WSContext.Provider>;
}

export function useWS() {
  return useContext(WSContext);
}
