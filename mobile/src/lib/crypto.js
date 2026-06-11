// AES-256-GCM field encryption for React Native / Expo Go.
//
// Byte-identical to the web crypto module — same blob format:
//   "v1:" + base64(iv) + ":" + base64(ciphertext+tag)
//
// Replaces Web Crypto (unavailable in RN) with:
//   @noble/ciphers → pure-JS AES-256-GCM
//   base64-js      → replaces btoa/atob
//   expo-crypto    → getRandomBytes / randomUUID

import { gcm } from '@noble/ciphers/aes';
import { fromByteArray, toByteArray } from 'base64-js';
import { getRandomBytes } from 'expo-crypto';

const PREFIX = 'v1:';
const IV_BYTES = 12;

// Return the raw 32-byte key as Uint8Array. Async for API symmetry with web.
export async function importKey(base64Key) {
  const raw = toByteArray(base64Key);
  if (raw.length !== 32) throw new Error('Encryption key must be 32 bytes once base64-decoded.');
  return raw;
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

// Cache blob by plaintext to avoid re-encrypting unchanged fields (prevents sync churn).
const blobByPlain = new Map();

export async function encryptText(key, text) {
  const s = text == null ? '' : String(text);
  const cached = blobByPlain.get(s);
  if (cached) return cached;
  const iv = getRandomBytes(IV_BYTES);
  const plainBytes = new TextEncoder().encode(s);
  const ct = gcm(key, iv).encrypt(plainBytes);
  const blob = PREFIX + fromByteArray(iv) + ':' + fromByteArray(ct);
  blobByPlain.set(s, blob);
  return blob;
}

export async function decryptText(key, blob) {
  if (!isEncrypted(blob)) return blob == null ? '' : String(blob);
  const parts = blob.split(':');
  const iv = toByteArray(parts[1]);
  const ct = toByteArray(parts[2]);
  const pt = gcm(key, iv).decrypt(ct);
  const s = new TextDecoder().decode(pt);
  blobByPlain.set(s, blob); // seed cache so re-pushing won't churn
  return s;
}

export async function encryptTags(key, tags, plaintext) {
  const arr = Array.isArray(tags) ? tags : [];
  if (plaintext) return arr;
  return Promise.all(arr.map(t => encryptText(key, t)));
}

export async function decryptTags(key, tags) {
  const arr = Array.isArray(tags) ? tags : [];
  return Promise.all(arr.map(t => decryptText(key, t)));
}

export async function encryptJson(key, value, plaintext) {
  const arr = Array.isArray(value) ? value : [];
  if (plaintext) return arr;
  return encryptText(key, JSON.stringify(arr));
}

export async function decryptJson(key, value) {
  if (isEncrypted(value)) {
    try { return JSON.parse(await decryptText(key, value)); }
    catch { return []; }
  }
  return Array.isArray(value) ? value : [];
}
