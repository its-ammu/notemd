/** True when the UI is running inside the Tauri desktop shell. */
export function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isAppLocalUrl(url) {
  const host = url.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/** External http(s)/mailto/tel links — not in-app page: refs or same-origin paths. */
export function isExternalHref(href) {
  if (!href) return false;
  if (href.startsWith('#') || href.startsWith('page:') || href.startsWith('img:')) return false;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return true;
  try {
    const url = new URL(href, window.location.href);
    if (url.origin === window.location.origin) return false;
    if (isAppLocalUrl(url)) return false;
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function openExternal(href) {
  if (!href) return;
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(href);
    return;
  }
  window.open(href, '_blank', 'noopener,noreferrer');
}

/**
 * WKWebView / Tauri does nothing with target=_blank (no new window). Catch
 * those clicks and hand the URL to the OS browser.
 */
export function installExternalLinkHandler() {
  if (!isTauri()) return;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    if (a.target === '_blank' || isExternalHref(href)) {
      e.preventDefault();
      openExternal(href).catch((err) => console.error('Failed to open link', err));
    }
  }, true);
}
