import { BASE_URL } from "../config/constants";

const WS_URL = BASE_URL.replace(/^http/, "ws") + "/ws";
const MAX_RECONNECT_ATTEMPTS = 8;
const BASE_RECONNECT_DELAY_MS = 500;

class WebSocketManager {
  constructor() {
    this._ws = null;
    this._token = null;
    this._listeners = new Map(); // type -> Set<fn>
    this._messageQueue = [];
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._isConnecting = false;
    this._shouldConnect = false;
  }

  connect(token) {
    this._token = token;
    this._shouldConnect = true;
    this._reconnectAttempts = 0;
    this._doConnect();
  }

  disconnect() {
    this._shouldConnect = false;
    clearTimeout(this._reconnectTimer);
    if (this._ws) {
      this._ws.close(1000, "User logout");
      this._ws = null;
    }
  }

  _doConnect() {
    if (this._isConnecting || !this._shouldConnect) return;
    this._isConnecting = true;

    const url = `${WS_URL}?token=${encodeURIComponent(this._token || "")}`;
    try {
      this._ws = new WebSocket(url);
    } catch (e) {
      this._isConnecting = false;
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      this._isConnecting = false;
      this._reconnectAttempts = 0;
      // Drain queued messages
      while (this._messageQueue.length > 0) {
        const msg = this._messageQueue.shift();
        this._ws.send(JSON.stringify(msg));
      }
      this._emit("connected", {});
    };

    this._ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._emit(data.type, data);
      } catch (_) {}
    };

    this._ws.onerror = () => {};

    this._ws.onclose = (event) => {
      this._isConnecting = false;
      this._ws = null;
      this._emit("disconnected", { code: event.code });
      if (this._shouldConnect && event.code !== 1000) {
        this._scheduleReconnect();
      }
    };
  }

  _scheduleReconnect() {
    if (!this._shouldConnect) return;
    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;

    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this._reconnectAttempts),
      30000
    );
    this._reconnectAttempts++;
    this._reconnectTimer = setTimeout(() => this._doConnect(), delay);
  }

  send(message) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(message));
    } else {
      this._messageQueue.push(message);
    }
  }

  subscribeConversation(conversationId) {
    this.send({ type: "subscribe_conversation", conversation_id: conversationId });
  }

  sendTypingStart(conversationId) {
    this.send({ type: "typing_start", conversation_id: conversationId });
  }

  sendTypingStop(conversationId) {
    this.send({ type: "typing_stop", conversation_id: conversationId });
  }

  sendMarkRead(conversationId) {
    this.send({ type: "mark_read", conversation_id: conversationId });
  }

  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }

  _emit(type, data) {
    this._listeners.get(type)?.forEach((fn) => {
      try {
        fn(data);
      } catch (_) {}
    });
  }

  get isConnected() {
    return this._ws?.readyState === WebSocket.OPEN;
  }
}

export const wsManager = new WebSocketManager();
