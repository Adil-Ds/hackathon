import { create } from "zustand";

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (list) => {
    const unread = list.filter((n) => !n.is_read).length;
    set({ notifications: list, unreadCount: unread });
  },

  prependNotification: (note) =>
    set((state) => {
      const exists = state.notifications.find((n) => n.id === note.id);
      if (exists) return {};
      return {
        notifications: [note, ...state.notifications],
        unreadCount: state.unreadCount + (note.is_read ? 0 : 1),
      };
    }),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),

  setUnreadCount: (count) => set({ unreadCount: count }),
}));
