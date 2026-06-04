// Fetches the single app-wide encryption key and caches the imported CryptoKey
// in memory for the session.
//
// The key is held as a Supabase secret and handed out only to signed-in users by
// the `enc-key` edge function (verify_jwt = true). It is never stored in the
// database or baked into the JS bundle, so a DB dump alone stays useless.

import { supabase } from './supabase';
import { importKey } from './crypto';

let keyPromise = null; // memoized: fetch + import happen at most once per session

async function fetchKey() {
  const { data, error } = await supabase.functions.invoke('enc-key');
  if (error) throw new Error('Could not fetch encryption key: ' + error.message);
  if (!data || !data.key) throw new Error('Encryption key response was empty.');
  return importKey(data.key);
}

// Resolve to the in-memory CryptoKey, fetching it the first time. Concurrent
// callers share the one in-flight request. On failure the cache is cleared so a
// later call can retry (e.g. after the session token refreshes).
export function ensureKey() {
  if (!keyPromise) {
    keyPromise = fetchKey().catch(err => {
      keyPromise = null;
      throw err;
    });
  }
  return keyPromise;
}

// Drop the cached key, e.g. on sign-out.
export function clearKey() {
  keyPromise = null;
}
