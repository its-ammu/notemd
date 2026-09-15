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

// Opaque reference scheme stored in markdown in place of the full Supabase URL,
// e.g. `![alt](img:<userId>/<uuid>.png)`. The real public URL is reconstructed
// only at display time (see resolveImageSrc / MarkdownView), so the project ref
// never lives in note content, the editor source, or shared-page payloads.
export const IMAGE_REF_SCHEME = 'img:';

// Display sizes a user can pick for an image, stored as a `#<id>` fragment on
// the image ref (e.g. `img:<path>#sm`). Applied as a max-width percentage of the
// content column so small images are never upscaled. `pct: null` (Large) means
// no constraint beyond the content width — the default when no size is set.
export const IMAGE_SIZES = [
  { id: 'sm', label: 'Small', pct: 33 },
  { id: 'md', label: 'Medium', pct: 66 },
  { id: 'lg', label: 'Large', pct: null },
];
const SIZE_IDS = new Set(IMAGE_SIZES.map((z) => z.id));

/* Build the public URL for a stored image path. */
export function publicUrlForPath(path) {
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}

/* Split a stored image `src` into its addressable part and optional size token,
   e.g. `img:a/b.png#sm` → { base: 'img:a/b.png', size: 'sm' }. A trailing `#id`
   is only treated as a size when it's a known size id, so it won't swallow real
   URL fragments. */
export function parseImageRef(src) {
  const s = typeof src === 'string' ? src : '';
  const hashAt = s.lastIndexOf('#');
  if (hashAt !== -1) {
    const frag = s.slice(hashAt + 1);
    if (SIZE_IDS.has(frag)) return { base: s.slice(0, hashAt), size: frag };
  }
  return { base: s, size: null };
}

/* CSS max-width for a size id, or null for Large/unset (natural up to column). */
export function imageMaxWidthForSize(size) {
  const pct = IMAGE_SIZES.find((z) => z.id === size)?.pct;
  return pct ? `${pct}%` : null;
}

/* Turn whatever sits in a markdown image's `src` into a real URL (size fragment
   stripped):
   - `img:<path>`  → resolved Supabase public URL
   - anything else → returned untouched (legacy full URLs, external images) */
export function resolveImageSrc(src) {
  const { base } = parseImageRef(src);
  if (base.startsWith(IMAGE_REF_SCHEME)) {
    return publicUrlForPath(base.slice(IMAGE_REF_SCHEME.length));
  }
  return base;
}

/* Rewrite a page body so the image whose markdown src is exactly `oldSrc` gets
   the given size (or natural/Large when sizeId is falsy). Returns the new body. */
export function setImageRefSize(body, oldSrc, sizeId) {
  const { base } = parseImageRef(oldSrc);
  const newSrc = sizeId && sizeId !== 'lg' ? `${base}#${sizeId}` : base;
  if (newSrc === oldSrc) return body;
  return body.split(`](${oldSrc})`).join(`](${newSrc})`);
}

/**
 * Validate + upload an image file to the page-images bucket and return an
 * opaque `img:<path>` reference (not the full URL). Throws an Error with a
 * user-friendly message on failure.
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

  return `${IMAGE_REF_SCHEME}${path}`;
}
