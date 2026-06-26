import { useEffect, useMemo, useRef, useState } from 'react';
import { useStoredState } from './useStoredState';

// 24/7 YouTube live streams (lofi.cafe-style). These play through the
// YouTube IFrame API (they can't go through a plain <audio> element), so the
// video stays visible in a small framed "TV" — required by YouTube's terms.
// Note: 24/7 streams get replaced when channels restart them. If a station
// starts showing "live stream recording is not available", grab the new id
// from the channel's /live page (e.g. youtube.com/@LofiGirl/live).
export const BUILT_IN_STATIONS = [
  { id: 'X4VbdwhkE10', name: 'Lofi Beats', sub: 'beats to relax & study to', by: 'lofi girl' },
  { id: 'JD-kMIpDfnY', name: 'Lofi Sleep', sub: 'beats to sleep/chill to', by: 'lofi girl' },
  { id: 'jpGBUBXo9VI', name: 'Chillhop', sub: 'essentials radio · chill beats', by: 'chillhop' },
  { id: '5yx6BWlEVcY', name: 'Jazzy Lofi', sub: 'jazzy & lofi hip hop', by: 'chillhop' },
];

/** @deprecated use BUILT_IN_STATIONS */
export const STATIONS = BUILT_IN_STATIONS;

export function stationVideoId(st) {
  return st?.videoId || st?.id;
}

// ---------------------------------------------------------------------------
// Module-level singleton player.
//
// React StrictMode double-mounts App in dev. If the player were owned by the
// hook instance, the second mount would create a second YT.Player bound to
// the same #nmd-yt-player element and events would go to the dead instance
// (symptom: stuck on "tuning in" forever). One module-level player + a
// `bridge` the live hook instance wires its state setters into avoids that.
// ---------------------------------------------------------------------------

let ytApiPromise = null;
let playerPromise = null;
let player = null;

const log = (...args) => console.info('[lofi-radio]', ...args);

const STATE_NAMES = {
  '-1': 'UNSTARTED', 0: 'ENDED', 1: 'PLAYING', 2: 'PAUSED', 3: 'BUFFERING', 5: 'CUED',
};

const ERROR_MEANINGS = {
  2: 'invalid video id',
  5: 'HTML5 player error',
  100: 'video not found or private',
  101: 'embedding disabled for this video',
  150: 'embedding disabled for this video',
  153: 'player configuration error (origin mismatch?)',
};

// Wired to the currently mounted hook instance (App is a singleton).
const bridge = {
  volume: 0.7,
  onState: () => {},
  onError: () => {},
};

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    log('loading YouTube iframe API…');
    ytApiPromise = new Promise(resolve => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); log('iframe API ready'); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => log('FAILED to load iframe_api script (ad blocker / network?)');
      document.head.appendChild(s);
    });
  }
  return ytApiPromise;
}

function playerIsAttached() {
  try { return !!player && document.body.contains(player.getIframe()); } catch { return false; }
}

// If React remounted the app shell (auth refresh, hot reload), the player's
// iframe was destroyed with it. Drop the dead handle so the next play
// recreates the player inside the fresh container div.
function resetIfDetached() {
  if (player && !playerIsAttached()) {
    log('player iframe was detached — resetting for recreation');
    try { player.destroy?.(); } catch { /* ignore */ }
    player = null;
    playerPromise = null;
  }
}

function ensurePlayerSingleton() {
  resetIfDetached();
  if (!playerPromise) {
    playerPromise = loadYouTubeApi().then(YT => new Promise((resolve, reject) => {
      let el = document.getElementById('nmd-yt-player');
      if (!el) {
        // App not fully rendered yet (e.g. auth screen). Reset so the next
        // call retries instead of waiting on this dead attempt forever.
        log('container #nmd-yt-player not in DOM — will retry on next play');
        playerPromise = null;
        reject(new Error('player container missing'));
        return;
      }
      // Hot-reload can orphan the previous player's iframe (it keeps our id).
      // Attaching to it never fires onReady, so start from a fresh div.
      if (el.tagName === 'IFRAME') {
        log('replacing stale iframe left behind by hot-reload');
        const fresh = document.createElement('div');
        fresh.id = 'nmd-yt-player';
        el.replaceWith(fresh);
        el = fresh;
      }
      log('creating player');
      const readyTimeout = setTimeout(() => {
        log('onReady never fired (15s) — resetting player for a clean retry');
        playerPromise = null;
        try { p.destroy?.(); } catch { /* ignore */ }
        reject(new Error('player init timeout'));
      }, 15000);
      const p = new YT.Player(el, {
        host: 'https://www.youtube-nocookie.com', // privacy-enhanced mode — avoids Safari ITP cookie blocking (Error 153)
        width: '100%',
        height: '100%',
        playerVars: {
          playsinline: 1,
          rel: 0,
          controls: 0,       // our doodle controls drive everything
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3, // no annotations
          modestbranding: 1, // suppress YouTube logo
          showinfo: 0,       // hide title/uploader overlay
          cc_load_policy: 0, // don't auto-show captions
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            clearTimeout(readyTimeout);
            log('player ready');
            // Safari needs explicit autoplay permission on the iframe
            try {
              const iframe = p.getIframe();
              if (iframe) {
                if (!iframe.allow?.includes('autoplay')) {
                  iframe.allow = 'autoplay; encrypted-media';
                }
                iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
              }
            } catch { /* ignore */ }
            p.setVolume(Math.round(bridge.volume * 100));
            player = p;
            resolve(p);
          },
          onStateChange: (e) => {
            log('state →', STATE_NAMES[String(e.data)] ?? e.data);
            bridge.onState(e.data, YT.PlayerState);
          },
          onError: (e) => {
            const meaning = ERROR_MEANINGS[e.data] || 'unknown error';
            log('player error', e.data, '—', meaning);
            bridge.onError(`YouTube error ${e.data}: ${meaning}.`);
          },
        },
      });
    }));
  }
  return playerPromise;
}

export function useRadio({ onError } = {}) {
  const [customStations, setCustomStations] = useStoredState('nmd_radio_custom', []);
  const [stationId, setStationId] = useStoredState('nmd_radio_station', BUILT_IN_STATIONS[0].id);
  const [volume, setVolume] = useStoredState('nmd_radio_volume', 0.7);
  const [playing, setPlaying] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sleepMins, setSleepMins] = useState(null); // chosen duration, null = off

  const playingRef = useRef(false);
  const onErrorRef = useRef(null);
  const watchdog = useRef(null);
  const sleepTimer = useRef(null);

  const stations = useMemo(
    () => [
      ...BUILT_IN_STATIONS.map(s => ({ ...s, custom: false })),
      ...customStations.map(s => ({ ...s, custom: true })),
    ],
    [customStations],
  );

  const station = stations.find(s => s.id === stationId) || stations[0];

  // Drop a saved selection that no longer exists (deleted custom, removed built-in).
  useEffect(() => {
    if (stationId && stations.length && !stations.some(s => s.id === stationId)) {
      setStationId(stations[0].id);
    }
  }, [stationId, stations, setStationId]);

  // Keep the singleton's bridge pointed at this (the live) hook instance.
  useEffect(() => {
    onErrorRef.current = onError;
    bridge.onState = (state, S) => {
      if (state === S.PLAYING) {
        clearTimeout(watchdog.current);
        playingRef.current = true;
        setPlaying(true);
        setConnecting(false);
      } else if (state === S.BUFFERING) {
        setConnecting(true);
      } else if (state === S.PAUSED || state === S.ENDED || state === S.CUED) {
        playingRef.current = false;
        setPlaying(false);
        setConnecting(false);
      }
    };
    bridge.onError = (msg) => {
      clearTimeout(watchdog.current);
      playingRef.current = false;
      setPlaying(false);
      setConnecting(false);
      onErrorRef.current?.(msg);
    };
  });

  useEffect(() => {
    bridge.volume = volume;
    if (playerIsAttached()) player.setVolume(Math.round(volume * 100));
  }, [volume]);

  const ensurePlayer = () => ensurePlayerSingleton();

  const play = (st) => {
    const target = st || station;
    log('play requested:', target.name, `(${target.id})`);
    setConnecting(true);
    // If nothing is actually rolling after 12s, stop pretending — surface it.
    clearTimeout(watchdog.current);
    watchdog.current = setTimeout(() => {
      if (!playingRef.current) {
        let stuckState = 'unknown';
        try { stuckState = STATE_NAMES[String(player?.getPlayerState?.())] ?? 'unknown'; } catch { /* ignore */ }
        log('watchdog fired — never reached PLAYING, player state:', stuckState);
        setConnecting(false);
        onErrorRef.current?.(
          stuckState === 'UNSTARTED' || stuckState === 'CUED'
            ? 'Autoplay seems blocked — press ▶ directly on the video once.'
            : 'Stream won’t start — it may be offline. Try another station?'
        );
      }
    }, 12000);
    ensurePlayer().then(p => {
      log('loadVideoById + playVideo:', stationVideoId(target));
      p.loadVideoById(stationVideoId(target));
      p.playVideo();
    }).catch((err) => {
      log('ensurePlayer failed:', err?.message || err);
      clearTimeout(watchdog.current);
      setConnecting(false);
      onErrorRef.current?.('Could not start the player — press play to retry (if it keeps failing, an ad blocker may be interfering).');
    });
  };

  const pause = () => {
    log('pause requested');
    clearTimeout(watchdog.current);
    if (playerIsAttached()) player.pauseVideo();
    playingRef.current = false;
    setPlaying(false);
    setConnecting(false);
  };

  const toggle = () => (playing || connecting ? pause() : play());

  const selectStation = (id) => {
    setStationId(id);
    if (playing || connecting) {
      const st = stations.find(s => s.id === id);
      if (st) play(st);
    }
  };

  const addCustomStation = ({ name, videoId, sub, by }) => {
    const entry = {
      id: `c_${crypto.randomUUID()}`,
      videoId,
      name,
      sub,
      by,
      custom: true,
    };
    setCustomStations(prev => [...prev, entry]);
    setStationId(entry.id);
    return entry;
  };

  const updateCustomStation = (id, patch) => {
    setCustomStations(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
    if (stationId === id && (playing || connecting)) {
      const st = { ...stations.find(s => s.id === id), ...patch };
      play(st);
    }
  };

  const deleteCustomStation = (id) => {
    setCustomStations(prev => prev.filter(s => s.id !== id));
    if (stationId === id) {
      const fallback = BUILT_IN_STATIONS[0].id;
      setStationId(fallback);
      if (playing || connecting) {
        const st = stations.find(s => s.id === fallback);
        if (st) play(st);
      }
    }
  };

  // Sleep timer: stop playback after the chosen number of minutes.
  const setSleepMinutes = (mins) => {
    clearTimeout(sleepTimer.current);
    setSleepMins(mins || null);
    if (mins) {
      sleepTimer.current = setTimeout(() => {
        pause();
        setSleepMins(null);
      }, mins * 60000);
    }
  };

  // Clear this instance's timers on unmount. The player itself is a module
  // singleton and survives StrictMode remounts on purpose.
  useEffect(() => () => {
    clearTimeout(sleepTimer.current);
    clearTimeout(watchdog.current);
  }, []);

  return {
    stations,
    station,
    playing,
    connecting,
    volume, setVolume,
    sleepMins, setSleepMinutes,
    play, pause, toggle, selectStation,
    addCustomStation, updateCustomStation, deleteCustomStation,
    ensurePlayer,
  };
}
