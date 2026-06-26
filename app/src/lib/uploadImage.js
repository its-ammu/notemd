import { supabase } from './supabase';

// Supabase Storage bucket for page images. Must be created manually in the
// dashboard (see docs/image-upload-setup.md) with user-scoped RLS policies.
export const IMAGE_BUCKET = 'page-images';

// Hard client-side size limit. Keep in sync with the bucket's file_size_limit
// in Supabase (set there too so the server rejects oversized uploads as well).
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function prettyBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate + upload an image file to the page-images bucket and return its
 * public URL. Throws an Error with a user-friendly message on failure.
 */
export async function uploadImage(file) {
  if (!file) throw new Error('No file provided.');

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Unsupported image type. Use PNG, JPEG, GIF, WebP, or SVG.');
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image is too large (${prettyBytes(file.size)}). Max ${prettyBytes(MAX_IMAGE_BYTES)}.`
    );
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw new Error('You must be signed in to upload images.');

  const ext = EXT_BY_TYPE[file.type] || 'png';
  const rand = crypto.randomUUID();
  const path = `${userData.user.id}/${rand}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Could not resolve image URL after upload.');

  return data.publicUrl;
}
