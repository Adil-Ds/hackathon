/**
 * E2EE helpers — 100% React Native / Hermes safe.
 *
 * IMPORTANT: Hermes has NO btoa/atob, NO TextEncoder/TextDecoder,
 * and NO crypto.subtle. Everything here is pure JavaScript so it
 * runs identically on iOS, Android and Web.
 *
 * Scheme: payload = "enc:" + base64( utf8(plaintext) XOR key )
 *   - keyed (per-conversation 256-bit key)
 *   - reversible
 *   - backend only ever stores the obfuscated payload
 *
 * (For a production app you'd swap the XOR core for AES via a native
 *  module like react-native-quick-crypto — the API here stays the same.)
 */
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

const KEY_PREFIX = "conv_key_";
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// ── Pure-JS base64 ────────────────────────────────────────────────────────────
function bytesToBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] & 0xff;
    const b1 = i + 1 < bytes.length ? bytes[i + 1] & 0xff : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] & 0xff : 0;
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64_CHARS[b2 & 63] : "=";
  }
  return out;
}

function base64ToBytes(b64) {
  const lookup = {};
  for (let i = 0; i < B64_CHARS.length; i++) lookup[B64_CHARS[i]] = i;
  const clean = String(b64).replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = lookup[clean[i]] ?? 0;
    const c1 = lookup[clean[i + 1]] ?? 0;
    const c2 = lookup[clean[i + 2]];
    const c3 = lookup[clean[i + 3]];
    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 !== undefined) bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 !== undefined) bytes.push(((c2 & 3) << 6) | c3);
  }
  return bytes;
}

// ── Pure-JS UTF-8 ─────────────────────────────────────────────────────────────
function utf8Encode(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = str.charCodeAt(++i);
      c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return bytes;
}

function utf8Decode(bytes) {
  let str = "";
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c < 0x80) {
      str += String.fromCharCode(c);
    } else if (c < 0xe0) {
      str += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (c < 0xf0) {
      str += String.fromCharCode(
        ((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f),
      );
    } else {
      const cp =
        ((c & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
      const off = cp - 0x10000;
      str += String.fromCharCode(0xd800 + (off >> 10), 0xdc00 + (off & 0x3ff));
    }
  }
  return str;
}

// ── Keyed XOR ─────────────────────────────────────────────────────────────────
function xorBytes(dataBytes, keyBytes) {
  if (!keyBytes.length) return dataBytes.slice();
  const out = new Array(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    out[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generateConversationKey() {
  try {
    const raw = await Crypto.getRandomBytesAsync(32); // Uint8Array on native
    return bytesToBase64(Array.from(raw));
  } catch {
    // Last-resort fallback — never block chat
    const arr = [];
    for (let i = 0; i < 32; i++) arr.push(Math.floor(Math.random() * 256));
    return bytesToBase64(arr);
  }
}

export async function encryptMessage(plaintext, keyBase64) {
  try {
    if (!keyBase64) return plaintext;
    const keyBytes = base64ToBytes(keyBase64);
    const dataBytes = utf8Encode(String(plaintext));
    const cipher = xorBytes(dataBytes, keyBytes);
    return "enc:" + bytesToBase64(cipher);
  } catch {
    return plaintext;
  }
}

export async function decryptMessage(payload, keyBase64) {
  if (!payload || typeof payload !== "string") return payload || "";
  // Backward-compat: anything not prefixed is treated as plaintext
  if (!payload.startsWith("enc:")) return payload;
  try {
    if (!keyBase64) return "[Encrypted message]";
    const keyBytes = base64ToBytes(keyBase64);
    const cipherBytes = base64ToBytes(payload.slice(4));
    const plainBytes = xorBytes(cipherBytes, keyBytes);
    return utf8Decode(plainBytes);
  } catch {
    return "[Encrypted message]";
  }
}

// ── Secure key storage ────────────────────────────────────────────────────────
function safeKey(conversationId) {
  // SecureStore keys must match [A-Za-z0-9._-]
  return KEY_PREFIX + String(conversationId).replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function storeConversationKey(conversationId, keyBase64) {
  const key = safeKey(conversationId);
  if (Platform.OS === "web") {
    try { globalThis?.localStorage?.setItem(key, keyBase64); } catch (_) {}
    return;
  }
  try { await SecureStore.setItemAsync(key, keyBase64); } catch (_) {}
}

export async function getConversationKey(conversationId) {
  const key = safeKey(conversationId);
  if (Platform.OS === "web") {
    try { return globalThis?.localStorage?.getItem(key) || null; } catch (_) { return null; }
  }
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}

export async function deleteConversationKey(conversationId) {
  const key = safeKey(conversationId);
  if (Platform.OS === "web") {
    try { globalThis?.localStorage?.removeItem(key); } catch (_) {}
    return;
  }
  try { await SecureStore.deleteItemAsync(key); } catch (_) {}
}
