import React, { useState, useEffect, useRef } from 'react';

const WORK_SECS = 25 * 60;
const BREAK_SECS = 5 * 60;

const LABELS = {
  work: 'scribbling',
  break: 'caffeinating',
  doneWork: 'chapter done!',
  doneBreak: 'caffeinated!',
};

function notify(title, body, onFallback) {
  if (!('Notification' in window)) { onFallback?.(title + ' — ' + body); return; }
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/favicon.ico' }); } catch (_) { onFallback?.(title + ' — ' + body); }
  } else {
    onFallback?.(title + ' — ' + body);
  }
}

async function playChime(mode) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    const notes = mode === 'work'
      ? [{ f: 523, t: 0 }, { f: 659, t: 0.18 }, { f: 784, t: 0.36 }]
      : [{ f: 392, t: 0 }, { f: 330, t: 0.2 }];
    notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.8);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.8);
    });
  } catch (_) { }
}

function CandlePixel({ progress, phase, running }) {
  const MAX_WAX = 10;
  const HOLDER_Y = 14;
  const visibleWax = Math.max(1, Math.ceil(MAX_WAX * progress));
  const waxTop = HOLDER_Y - visibleWax;
  const wickY = waxTop - 1;
  const showFlame = phase !== 'done';
  const showSmoke = phase === 'done';
  const flickerCls = running && showFlame ? 'candle-flame-flicker' : '';
  const WAX = '#F5F0E6', WAX_SHADE = '#DDD5C0', WAX_HILITE = '#FDFBF5';
  const HOLDER = '#9C7E5A', HOLDER_DRK = '#7A6040', WICK = '#3E2723';
  const showDrip = progress < 0.85 && progress > 0.15;

  return (
    <svg width="60" height="80" viewBox="0 0 12 16"
      style={{ imageRendering: 'pixelated', display: 'block', overflow: 'visible' }}>
      <rect x="1" y={HOLDER_Y} width="10" height="1" fill={HOLDER} />
      <rect x="0" y={HOLDER_Y + 1} width="12" height="2" fill={HOLDER_DRK} />
      <rect x="1" y={HOLDER_Y + 1} width="10" height="1" fill={HOLDER} />
      <rect x="2" y={waxTop} width="1" height={visibleWax} fill={WAX_SHADE} />
      <rect x="3" y={waxTop} width="6" height={visibleWax} fill={WAX} />
      <rect x="4" y={waxTop} width="1" height={visibleWax} fill={WAX_HILITE} />
      <rect x="9" y={waxTop} width="1" height={visibleWax} fill={WAX_SHADE} />
      {showDrip && <rect x="9" y={waxTop + 1} width="1" height="2" fill={WAX_SHADE} />}
      <rect x="5" y={wickY} width="2" height="1" fill={WICK} />
      {showFlame && (
        <g className={flickerCls} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
          <rect x="5" y={wickY - 4} width="2" height="1" fill="#FFF9C4" />
          <rect x="4" y={wickY - 3} width="4" height="1" fill="#FFE082" />
          <rect x="3" y={wickY - 2} width="6" height="1" fill="#FFB300" />
          <rect x="4" y={wickY - 1} width="4" height="1" fill="#FF8F00" opacity="0.8" />
        </g>
      )}
      {showSmoke && (
        <g className="candle-smoke-wisps">
          <rect x="5" y={wickY - 2} width="2" height="1" fill="#AAA" opacity="0.5" />
          <rect x="4" y={wickY - 4} width="2" height="1" fill="#AAA" opacity="0.35" />
          <rect x="6" y={wickY - 6} width="2" height="1" fill="#AAA" opacity="0.2" />
        </g>
      )}
      {running && showFlame && (
        <ellipse cx="6" cy={wickY - 2} rx="3" ry="2.5" fill="#FFB300" opacity="0.12" />
      )}
    </svg>
  );
}

function TeaCupPixel({ running, phase }) {
  const RIM = '#EDD5B3';
  const BODY = '#D4A96A';
  const DARK = '#A8784A';
  const TEA = '#C07830';
  const SAUCER = '#C8A87A';
  const STEAM = '#A0AFA8';

  return (
    <svg width="60" height="80" viewBox="0 0 12 16"
      style={{ imageRendering: 'pixelated', display: 'block', overflow: 'visible' }}>

      {/* Steam wisps — animate when running */}
      {running && phase !== 'done' && (
        <>
          <rect className="tea-steam-1" x="3" y="2" width="1" height="2" fill={STEAM} />
          <rect className="tea-steam-2" x="6" y="1" width="1" height="2" fill={STEAM} />
          <rect className="tea-steam-3" x="9" y="2" width="1" height="2" fill={STEAM} />
        </>
      )}

      {/* Rim highlight */}
      <rect x="2" y="4" width="8" height="1" fill={RIM} />
      {/* Cup walls */}
      <rect x="2" y="5" width="1" height="5" fill={DARK} />
      <rect x="9" y="5" width="1" height="5" fill={DARK} />
      {/* Tea fill */}
      <rect x="3" y="5" width="6" height="1" fill={TEA} />
      {/* Cup body fill */}
      <rect x="3" y="6" width="6" height="4" fill={BODY} />
      {/* Cup bottom */}
      <rect x="2" y="10" width="8" height="1" fill={DARK} />

      {/* Handle */}
      <rect x="10" y="5" width="1" height="1" fill={DARK} />
      <rect x="11" y="6" width="1" height="3" fill={DARK} />
      <rect x="10" y="9" width="1" height="1" fill={DARK} />

      {/* Saucer */}
      <rect x="1" y="11" width="10" height="1" fill={SAUCER} />
      <rect x="0" y="12" width="12" height="1" fill={DARK} />
    </svg>
  );
}

export default function PomodoroTimer({ task, onClose, onSessionComplete, onToast, workSecs = WORK_SECS, breakSecs = BREAK_SECS }) {
  const [mode, setMode] = useState('work');
  const [secondsLeft, setSecondsLeft] = useState(workSecs);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [sessions, setSessions] = useState(0);
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - 228,
    y: window.innerHeight - 360,
  }));

  // Request notification permission as soon as the widget opens
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef(null);

  // Drag handlers
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      const W = widgetRef.current?.offsetWidth || 200;
      const H = widgetRef.current?.offsetHeight || 320;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - W, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - H, e.clientY - dragOffset.current.y)),
      });
    };
    const onMouseUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const onMouseDown = (e) => {
    if (e.target.closest('button')) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  // Timer logic
  const onCompleteRef = useRef(null);
  onCompleteRef.current = () => {
    setRunning(false);
    setPhase('done');
    playChime(mode);
    if (mode === 'work') {
      setSessions(n => n + 1);
      onSessionComplete?.(task?.id, task?.title, Math.round(workSecs / 60));
      notify('Chapter done! ☕', task ? `"${task.title}" — time to recharge.` : 'Time to recharge.', onToast);
      setTimeout(() => { setMode('break'); setSecondsLeft(breakSecs); setPhase('idle'); }, 2500);
    } else {
      notify('Caffeinated! ✍️', 'Back to scribbling.', onToast);
      setTimeout(() => { setMode('work'); setSecondsLeft(workSecs); setPhase('idle'); }, 2500);
    }
  };

  // Timestamp-based timer — stays accurate even when tab is throttled in background
  const startedAtRef = useRef(null);
  const startSecsRef = useRef(null);
  useEffect(() => {
    if (!running) return;
    startedAtRef.current = Date.now();
    startSecsRef.current = secondsLeft;
    let done = false;
    const id = setInterval(() => {
      if (done) return;
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const remaining = Math.max(0, startSecsRef.current - elapsed);
      setSecondsLeft(remaining);
      if (remaining === 0) {
        done = true;
        clearInterval(id);
        setTimeout(() => onCompleteRef.current?.(), 0);
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const toggle = () => {
    if (phase === 'done') return;
    if (running) {
      setRunning(false); setPhase('idle');
    } else {
      setRunning(true); setPhase('running');
    }
  };

  const reset = () => {
    setRunning(false); setMode('work');
    setSecondsLeft(workSecs); setPhase('idle');
  };

  const totalSecs = mode === 'work' ? workSecs : breakSecs;
  const progress = secondsLeft / totalSecs;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const modeLabel = phase === 'done'
    ? (mode === 'work' ? LABELS.doneWork : LABELS.doneBreak)
    : mode === 'work' ? LABELS.work : LABELS.break;

  return (
    <div
      ref={widgetRef}
      className="nmd-pomo"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={onMouseDown}
    >
      {/* Drag hint */}
      <div className="nmd-pomo-handle">
        <span /><span /><span />
      </div>

      <button className="nmd-pomo-close" onClick={onClose} title="Close">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {mode === 'work'
        ? <CandlePixel progress={progress} phase={phase} running={running} />
        : <TeaCupPixel running={running} phase={phase} />
      }

      <div className={'nmd-pomo-mode' + (mode === 'break' ? ' is-break' : '') + (phase === 'done' ? ' is-done' : '')}>
        {modeLabel}
      </div>

      <div className="nmd-pomo-timer">
        {String(mins).padStart(2, '0')}
        <span className={'nmd-pomo-colon' + (running ? ' blinking' : '')}>:</span>
        {String(secs).padStart(2, '0')}
      </div>

      {task && (
        <div className="nmd-pomo-taskname">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M8 12l3 3 5-5" />
          </svg>
          <span>{task.title}</span>
        </div>
      )}

      <div className="nmd-pomo-controls">
        <button
          className={'nmd-pomo-btn primary' + (running ? ' active' : '')}
          onClick={toggle}
          disabled={phase === 'done'}
        >
          {running
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3l15 9-15 9z" /></svg>
          }
          {running ? 'pause' : 'start'}
        </button>
        <button className="nmd-pomo-btn" onClick={reset} title="Reset">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      {/* {sessions > 0 && (
        <div className="nmd-pomo-sessions">
          {Array.from({ length: Math.min(sessions, 8) }, (_, i) => (
            <span key={i} className="nmd-pomo-session-pip" title={`Session ${i + 1}`} />
          ))}
          {sessions > 8 && <span className="nmd-pomo-sessions-extra">+{sessions - 8}</span>}
        </div>
      )} */}
    </div>
  );
}
