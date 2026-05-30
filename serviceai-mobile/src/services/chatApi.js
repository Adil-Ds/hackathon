import { BASE_URL } from "../config/constants";

let _authToken = null;

export function setChatAuthToken(token) {
  _authToken = token;
}

const chatRequest = async (endpoint, method = "GET", body = null) => {
  const headers = { "Content-Type": "application/json" };
  if (_authToken) headers["Authorization"] = `Bearer ${_authToken}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }
  return response.json();
};

export const ChatAPI = {
  // ── Auth v2 ──────────────────────────────────────────────────────────────
  syncUser: (firebaseUid, email, name, role = "user", phone = null) =>
    chatRequest("/v2/auth/sync", "POST", {
      firebase_uid: firebaseUid,
      email,
      name,
      role,
      phone,
    }),

  // Ensure a user exists in PG by Firebase UID — no auth required
  ensureUser: (firebaseUid, email, name, role = "user", phone = null) =>
    chatRequest("/v2/auth/ensure-user", "POST", {
      firebase_uid: firebaseUid,
      email,
      name,
      role,
      phone,
    }),

  getMe: () => chatRequest("/v2/auth/me"),

  updateProfile: (name, phone, avatarUrl) =>
    chatRequest("/v2/auth/me", "PATCH", {
      name,
      phone,
      avatar_url: avatarUrl,
    }),

  registerDevice: (deviceToken, publicKey, platform = "unknown") =>
    chatRequest("/v2/auth/device", "POST", {
      device_token: deviceToken,
      public_key: publicKey,
      platform,
    }),

  getPublicKey: (userId) => chatRequest(`/v2/auth/keys/${userId}`),

  // ── User name registration (SQLite-backed, works without PostgreSQL) ─────────
  registerUserName: (displayName) =>
    chatRequest("/v2/conversations/register-user", "POST", { display_name: displayName }),

  // ── Conversations ─────────────────────────────────────────────────────────
  listConversations: () => chatRequest("/v2/conversations"),

  createConversation: (participantIds, bookingId = null, participantNames = {}) =>
    chatRequest("/v2/conversations", "POST", {
      participant_ids: participantIds,
      booking_id: bookingId,
      participant_names: participantNames,
    }),

  getMessages: (conversationId, beforeId = null, limit = 50) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (beforeId) qs.set("before_id", beforeId);
    return chatRequest(`/v2/conversations/${conversationId}/messages?${qs}`);
  },

  sendMessage: (conversationId, encryptedPayload, messageType = "text") =>
    chatRequest(`/v2/conversations/${conversationId}/messages`, "POST", {
      encrypted_payload: encryptedPayload,
      message_type: messageType,
    }),

  markRead: (conversationId) =>
    chatRequest(`/v2/conversations/${conversationId}/read`, "POST"),

  sendTyping: (conversationId) =>
    chatRequest(`/v2/conversations/${conversationId}/typing`, "POST"),

  // ── Providers v2 ─────────────────────────────────────────────────────────
  onboardProvider: (data) => chatRequest("/v2/providers/onboard", "POST", data),

  getMyProviderProfile: () => chatRequest("/v2/providers/me"),

  listProviders: (category, city, area, limit = 20, offset = 0) => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (category) qs.set("category", category);
    if (city) qs.set("city", city);
    if (area) qs.set("area", area);
    return chatRequest(`/v2/providers?${qs}`);
  },

  getProviderPublicProfile: (providerId) =>
    chatRequest(`/v2/providers/${providerId}`),

  submitReview: (providerId, rating, comment = null) =>
    chatRequest(`/v2/providers/${providerId}/reviews`, "POST", { rating, comment }),

  // ── Bookings v2 ───────────────────────────────────────────────────────────
  listBookingsV2: () => chatRequest("/v2/bookings"),
  getBookingV2: (bookingId) => chatRequest(`/v2/bookings/${bookingId}`),
  updateBookingStatus: (bookingId, status, note = null) =>
    chatRequest(`/v2/bookings/${bookingId}/status`, "PATCH", { status, note }),
  getAnalyticsSummary: () => chatRequest("/v2/bookings/analytics/summary"),

  // ── Provider Search / Discovery ───────────────────────────────────────────
  searchProviders: ({
    q, category, city, area, min_rating, max_price, min_price,
    min_experience, verified_only, has_availability, sort_by,
    user_lat, user_lng, limit = 20, offset = 0,
  } = {}) => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q)               qs.set("q", q);
    if (category)        qs.set("category", category);
    if (city)            qs.set("city", city);
    if (area)            qs.set("area", area);
    if (min_rating)      qs.set("min_rating", String(min_rating));
    if (max_price)       qs.set("max_price", String(max_price));
    if (min_price)       qs.set("min_price", String(min_price));
    if (min_experience)  qs.set("min_experience", String(min_experience));
    if (verified_only)   qs.set("verified_only", "true");
    if (has_availability != null) qs.set("has_availability", String(has_availability));
    if (sort_by)         qs.set("sort_by", sort_by);
    if (user_lat)        qs.set("user_lat", String(user_lat));
    if (user_lng)        qs.set("user_lng", String(user_lng));
    return chatRequest(`/v2/search/providers?${qs}`);
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  listNotifications: (unread_only = false, limit = 50) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (unread_only) qs.set("unread_only", "true");
    return chatRequest(`/v2/notifications?${qs}`);
  },
  getUnreadCount: () => chatRequest("/v2/notifications/unread-count"),
  markNotificationRead: (id) =>
    chatRequest(`/v2/notifications/${id}/read`, "PATCH"),
  markAllNotificationsRead: () =>
    chatRequest("/v2/notifications/read-all", "POST"),
};
