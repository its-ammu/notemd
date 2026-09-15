import React from 'react';

export const SIDEBAR_DEFAULT = 280;
export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 520;
export const SIDEBAR_COLLAPSE = 88;

export function clampSidebarW(w) {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w));
}

export function shareBase() {
  const configured = import.meta.env.VITE_PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, '') + '/';
  const { origin, pathname } = window.location;
  if (/^(tauri:|https?:\/\/(localhost|127\.0\.0\.1|\[::1\]))/.test(origin)) {
    return 'https://notemd.littlebuilds.dev/';
  }
  return `${origin}${pathname}`;
}

export function makeLongPressProps(handler, timerRef) {
  return {
    onTouchStart: (e) => {
      const t = e.touches[0];
      if (!t) return;
      const x = t.clientX, y = t.clientY;
      timerRef.current = { id: setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(12);
        handler({ clientX: x, clientY: y });
        timerRef.current = { id: null, fired: true };
      }, 500), startX: x, startY: y, fired: false };
    },
    onTouchMove: (e) => {
      const info = timerRef.current;
      if (!info || info.fired) return;
      const t = e.touches[0];
      if (!t) return;
      if (Math.hypot(t.clientX - info.startX, t.clientY - info.startY) > 8) {
        clearTimeout(info.id); timerRef.current = null;
      }
    },
    onTouchEnd: (e) => {
      const info = timerRef.current;
      if (!info) return;
      if (info.fired) { e.preventDefault(); }
      else { clearTimeout(info.id); }
      timerRef.current = null;
    },
    onTouchCancel: () => {
      if (timerRef.current) { clearTimeout(timerRef.current.id); timerRef.current = null; }
    },
  };
}

export function makeSnippet(body, q) {
  if (!body || !q) return null;
  const flat = body.replace(/\s+/g, ' ').trim();
  const idx = flat.toLowerCase().indexOf(q);
  if (idx === -1) return null;
  const before = 30, after = 60;
  const start = Math.max(0, idx - before);
  const end = Math.min(flat.length, idx + q.length + after);
  const prefix = start > 0 ? '… ' : '';
  const suffix = end < flat.length ? ' …' : '';
  const matchStart = idx - start;
  const raw = flat.slice(start, end);
  return (
    <>
      {prefix}
      {raw.slice(0, matchStart)}
      <mark>{raw.slice(matchStart, matchStart + q.length)}</mark>
      {raw.slice(matchStart + q.length)}
      {suffix}
    </>
  );
}

export function formatShareExpiryDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
