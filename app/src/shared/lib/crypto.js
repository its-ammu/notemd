// Single-key, application-level field encryption (AES-256-GCM via Web Crypto).
//
// One app-wide key encrypts every user's content fields so that a DB leak yields
// only ciphertext. The key never lives in the database or the JS bundle — it is
// served to signed-in users by an authenticated edge function (see lib/encKey.js).
//
// Blob format:  "v1:" + base64(iv) + ":" + base64(ciphertext)
// Values without the "v1:" prefix are treated as plaintext. That keeps reads safe
// for (a) rows written before encryption was turned on and (b) deliberately-public
// shared pages, which we store plaintext on purpose.

const PREFIX = 'v1:';
const IV_BYTES = 12; // 96-bit nonce, the standard size for AES-GCM

function b64encode(bytes) {
  const arr = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function b64decode(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Import a base64-encoded 32-byte key into a non-extractable AES-GCM CryptoKey.
export async function importKey(base64Key) {
  const raw = b64decode(base64Key);
  if (raw.length !== 32) {
    throw new Error('Encryption key must be 32 bytes once base64-decoded.');
  }
  return crypto.subtle.importKey(
    'raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'],
  );
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

// A fresh random IV on every save would make every field look "changed" to the
// sync diff, re-uploading everything on each keystroke. Caching the blob by its
// plaintext keeps unchanged fields byte-identical across pushes, so the diff only
// ships fields the user actually edited. Same plaintext always maps to the same
// IV here, which is safe because an IV is only ever reused with its own plaintext.
const blobByPlain = new Map();

export async function encryptText(key, text) {
  const s = text == null ? '' : String(text);
  const cached = blobByPlain.get(s);
  if (cached) return cached;
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(s),
  );
  const blob = PREFIX + b64encode(iv) + ':' + b64encode(ct);
  blobByPlain.set(s, blob);
  return blob;
}

export async function decryptText(key, blob) {
  if (!isEncrypted(blob)) return blob == null ? '' : blob; // plaintext passthrough
  const [, ivB64, ctB64] = blob.split(':');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(ivB64) }, key, b64decode(ctB64),
  );
  const s = new TextDecoder().decode(pt);
  blobByPlain.set(s, blob); // seed the cache so re-pushing this value won't churn
  return s;
}

// ----- Array / structured helpers -----

// tags is a `text[]` column, so encrypt each element to keep it a real array.
export async function encryptTags(key, tags, plaintext) {
  const arr = Array.isArray(tags) ? tags : [];
  if (plaintext) return arr;
  return Promise.all(arr.map(t => encryptText(key, t)));
}

export async function decryptTags(key, tags) {
  const arr = Array.isArray(tags) ? tags : [];
  return Promise.all(arr.map(t => decryptText(key, t)));
}

// subtasks is a jsonb column of objects; encrypt the whole array into one blob
// and store it as a JSON string scalar.
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
  return Array.isArray(value) ? value : []; // plaintext passthrough
}
