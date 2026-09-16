/** True when the page origin can be sent as a YouTube embed Referer. */
export function isHttpPageOrigin() {
  return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

/**
 * Build a YouTube embed URL with the fields WKWebView/Tauri need.
 * Passing `origin=tauri://…` is what triggers Error 153 — only attach origin
 * for real http(s) pages. `widget_referrer` is YouTube's hosting-page hint.
 */
export function youtubeEmbedUrl(videoId) {
  const params = new URLSearchParams({
    enablejsapi: '1',
    playsinline: '1',
    rel: '0',
    controls: '0',
    disablekb: '1',
    fs: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    cc_load_policy: '0',
    autoplay: '0',
    widget_referrer: isHttpPageOrigin() ? window.location.href : 'https://www.youtube.com/',
  });
  if (isHttpPageOrigin()) params.set('origin', window.location.origin);
  const id = videoId ? encodeURIComponent(videoId) : '';
  return `https://www.youtube.com/embed/${id}?${params}`;
}

/** Stamp referrer/allow on a player iframe before it navigates (Error 153). */
export function stampYouTubeIframe(iframe) {
  iframe.setAttribute('referrerpolicy', 'origin');
  iframe.setAttribute('allowfullscreen', 'true');
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
  iframe.style.border = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
}

/** Replace a placeholder node with a YouTube iframe the IFrame API can bind to. */
export function mountYouTubeIframe(placeholder, videoId) {
  const iframe = document.createElement('iframe');
  iframe.id = placeholder.id || 'nmd-yt-player';
  iframe.title = 'Lo-fi radio';
  stampYouTubeIframe(iframe);
  iframe.src = youtubeEmbedUrl(videoId);
  placeholder.replaceWith(iframe);
  return iframe;
}

/** Pull an 11-char YouTube video id from a URL or bare id string. */
export function parseYouTubeVideoId(input) {
  const s = (input || '').trim();
  if (!s) return null;
  if (/^[\w-]{11}$/.test(s)) return s;

  try {
    const url = s.startsWith('http') ? new URL(s) : new URL(`https://${s}`);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return v;

      const parts = url.pathname.split('/').filter(Boolean);
      const liveIdx = parts.indexOf('live');
      if (liveIdx !== -1 && parts[liveIdx + 1] && /^[\w-]{11}$/.test(parts[liveIdx + 1])) {
        return parts[liveIdx + 1];
      }
      const embedIdx = parts.indexOf('embed');
      if (embedIdx !== -1 && parts[embedIdx + 1] && /^[\w-]{11}$/.test(parts[embedIdx + 1])) {
        return parts[embedIdx + 1];
      }
      const shortsIdx = parts.indexOf('shorts');
      if (shortsIdx !== -1 && parts[shortsIdx + 1] && /^[\w-]{11}$/.test(parts[shortsIdx + 1])) {
        return parts[shortsIdx + 1];
      }
    }
  } catch { /* not a URL */ }

  return null;
}
