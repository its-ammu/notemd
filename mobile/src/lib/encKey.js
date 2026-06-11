import { supabase } from './supabase';
import { importKey } from './crypto';

let keyPromise = null;

async function fetchKey() {
  const { data, error } = await supabase.functions.invoke('enc-key');
  if (error) throw new Error('Could not fetch encryption key: ' + error.message);
  if (!data?.key) throw new Error('Encryption key response was empty.');
  return importKey(data.key);
}

export function ensureKey() {
  if (!keyPromise) {
    keyPromise = fetchKey().catch(err => {
      keyPromise = null;
      throw err;
    });
  }
  return keyPromise;
}

export function clearKey() {
  keyPromise = null;
}
