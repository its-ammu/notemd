import React from 'react';

/**
 * Doodles — tiny hand-drawn-style SVG illustrations.
 * Deliberately wobbly paths, round caps, slight tilts. They inherit
 * `currentColor` for ink and use the accent variables for color pops,
 * so they adapt to light/dark themes automatically.
 */

const ink = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/* A steaming mug, leaning slightly, steam squiggles drift upward. */
export function DoodleMug({ size = 52, className = '' }) {
  return (
    <svg className={'nmd-doodle ' + className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(-3 32 38)">
        <path {...ink} d="M16 29 C15 30 14 44 17 51 C18 54 24 56 31 56 C38 56 44 54 45 51 C48 43 47 31 46 29 C38 31 24 31 16 29 Z" />
        <path {...ink} d="M46 33 C53 30 58 34 56 40 C54 46 49 48 45 47" />
        <path {...ink} strokeWidth="1.6" d="M24 42 C27 45 31 44 33 41" opacity="0.5" />
      </g>
      <g className="nmd-doodle-steam">
        <path {...ink} strokeWidth="1.8" d="M25 22 C23 18 27 16 25 11" />
        <path {...ink} strokeWidth="1.8" d="M35 23 C33 19 37 17 35 12" />
      </g>
    </svg>
  );
}

/* A lazy sun with uneven rays and a smile. */
export function DoodleSun({ size = 52, className = '' }) {
  return (
    <svg className={'nmd-doodle ' + className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(4 32 32)">
        <path {...ink} d="M32 19 C40 18 46 24 45 32 C44 40 38 46 31 45 C23 44 18 38 19 30 C20 23 25 20 32 19 Z" />
        <path {...ink} strokeWidth="1.8" d="M32 10 L32 5" />
        <path {...ink} strokeWidth="1.8" d="M47 15 L51 11" />
        <path {...ink} strokeWidth="1.8" d="M54 31 L60 31" />
        <path {...ink} strokeWidth="1.8" d="M48 47 L52 52" />
        <path {...ink} strokeWidth="1.8" d="M16 49 L13 53" />
        <path {...ink} strokeWidth="1.8" d="M10 32 L4 33" />
        <path {...ink} strokeWidth="1.8" d="M15 14 L11 11" />
        <circle cx="27" cy="29" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="37" cy="29" r="1.3" fill="currentColor" stroke="none" />
        <path {...ink} strokeWidth="1.8" d="M27 35 C29 38 35 38 37 34" />
      </g>
    </svg>
  );
}

/* An alarm clock on wonky legs. `wiggle` makes it ring. */
export function DoodleClock({ size = 52, className = '', wiggle = false }) {
  return (
    <svg className={'nmd-doodle ' + className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g className={wiggle ? 'nmd-doodle-wiggle' : ''}>
        <path {...ink} d="M32 15 C42 14 50 23 49 33 C48 43 41 51 31 50 C21 49 14 41 15 31 C16 21 23 16 32 15 Z" />
        <path {...ink} d="M21 13 C17 9 12 11 11 15" />
        <path {...ink} d="M43 13 C47 9 52 11 53 15" />
        <path {...ink} d="M23 50 L19 57" />
        <path {...ink} d="M41 50 L45 57" />
        <path {...ink} d="M32 24 L32 34 L39 37" />
      </g>
      {wiggle && (
        <g className="nmd-doodle-ringlines">
          <path {...ink} strokeWidth="1.6" d="M7 24 C5 28 5 33 7 37" />
          <path {...ink} strokeWidth="1.6" d="M57 24 C59 28 59 33 57 37" />
        </g>
      )}
    </svg>
  );
}

/* A spiral notebook with scribbles. */
export function DoodleNotebook({ size = 52, className = '' }) {
  return (
    <svg className={'nmd-doodle ' + className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(-2 32 32)">
        <path {...ink} d="M18 10 C30 8 44 9 48 10 C50 26 50 42 48 54 C36 56 24 55 17 54 C16 40 16 24 18 10 Z" />
        <path {...ink} strokeWidth="1.6" d="M13 16 C11 14 12 11 15 12 M13 26 C11 24 12 21 15 22 M13 36 C11 34 12 31 15 32 M13 46 C11 44 12 41 15 42" />
        <path {...ink} strokeWidth="1.6" d="M25 22 C31 21 38 21 42 22" opacity="0.6" />
        <path {...ink} strokeWidth="1.6" d="M25 30 C30 29 36 29 41 30" opacity="0.6" />
        <path {...ink} strokeWidth="1.6" d="M25 38 C29 37 33 37 36 38 C38 38 39 36 38 35" opacity="0.6" />
      </g>
    </svg>
  );
}

/* A page with a folded corner and a line that ends in a loop. */
export function DoodlePage({ size = 52, className = '' }) {
  return (
    <svg className={'nmd-doodle ' + className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(2 32 32)">
        <path {...ink} d="M18 9 C26 8 34 8 39 9 L48 18 C49 30 49 44 48 54 C38 56 26 55 18 54 C17 40 17 23 18 9 Z" />
        <path {...ink} d="M39 9 C39 13 40 17 48 18" />
        <path {...ink} strokeWidth="1.6" d="M25 26 C30 25 36 25 41 26" opacity="0.6" />
        <path {...ink} strokeWidth="1.6" d="M25 34 C30 33 35 33 40 34" opacity="0.6" />
        <path {...ink} strokeWidth="1.6" d="M25 42 C28 41 31 41 33 42 C36 43 37 40 35 39 C34 38 33 40 35 41" opacity="0.6" />
      </g>
    </svg>
  );
}

/* A wobbly checkbox with an oversized, overshooting check. */
export function DoodleCheck({ size = 52, className = '' }) {
  return (
    <svg className={'nmd-doodle ' + className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(-3 32 32)">
        <path {...ink} d="M16 18 C26 16 38 16 46 18 C48 28 48 40 46 48 C36 50 24 50 17 48 C15 38 15 27 16 18 Z" />
        <path {...ink} strokeWidth="2.4" stroke="var(--accent-blue)" d="M22 33 C26 38 28 41 30 43 C36 32 44 20 54 12" />
      </g>
    </svg>
  );
}

/* A confused magnifying glass. */
export function DoodleMagnifier({ size = 52, className = '' }) {
  return (
    <svg className={'nmd-doodle ' + className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g transform="rotate(-4 32 32)">
        <path {...ink} d="M28 12 C37 11 44 18 43 27 C42 36 35 42 27 41 C19 40 13 33 14 25 C15 17 21 13 28 12 Z" />
        <path {...ink} strokeWidth="2.4" d="M41 38 C45 42 49 47 52 51" />
        <path {...ink} strokeWidth="1.8" d="M25 21 C28 19 32 20 32 23 C32 26 28 26 28 29" />
        <circle cx="28" cy="34" r="1.2" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

/* A horizontal squiggle — hand-drawn underline. */
export function DoodleSquiggle({ width = 110, className = '' }) {
  return (
    <svg className={'nmd-doodle ' + className} width={width} height="10" viewBox="0 0 110 10" preserveAspectRatio="none" aria-hidden="true">
      <path {...ink} strokeWidth="2.2" stroke="var(--accent-blue)"
        d="M3 6 C12 2 20 9 30 5 C40 1 48 9 58 5 C68 1 76 9 86 5 C94 2 100 7 107 5" />
    </svg>
  );
}

/* A boombox with a cassette window. The spool groups get the
   `nmd-doodle-spool` class so CSS can spin them while the radio plays. */
export function DoodleBoombox({ size = 200, playing = false, className = '' }) {
  return (
    <svg
      className={'nmd-doodle nmd-boombox ' + (playing ? 'playing ' : '') + className}
      width={size} height={Math.round(size * 0.72)} viewBox="0 0 160 115" aria-hidden="true"
    >
      <g transform="rotate(-1.5 80 70)">
        {/* antenna */}
        <path {...ink} strokeWidth="1.8" d="M118 32 C128 22 138 14 150 8" />
        <circle cx="151" cy="7" r="2" fill="currentColor" stroke="none" />
        {/* handle */}
        <path {...ink} d="M52 32 C56 20 102 19 108 31" />
        {/* body — wobbly rounded box */}
        <path {...ink} d="M16 38 C14 40 12 92 16 102 C18 107 140 108 144 102 C148 94 147 42 144 38 C138 33 24 34 16 38 Z" />
        {/* left speaker */}
        <path {...ink} d="M44 71 C45 62 38 57 31 59 C24 61 21 68 23 75 C25 82 33 85 39 82 C43 80 44 76 44 71 Z" />
        <circle cx="33.5" cy="70.5" r="3" {...ink} strokeWidth="1.6" />
        {/* right speaker */}
        <path {...ink} d="M138 70 C139 62 132 57 125 58 C118 60 114 67 117 74 C119 81 127 84 133 81 C136 79 137 75 138 70 Z" />
        <circle cx="127.5" cy="70" r="3" {...ink} strokeWidth="1.6" />
        {/* cassette window */}
        <path {...ink} d="M56 56 C55 57 54 82 56 84 C58 86 102 86 104 84 C106 81 106 58 104 56 C100 54 60 54 56 56 Z" />
        {/* spools */}
        <g className="nmd-doodle-spool">
          <circle cx="70" cy="70" r="6" {...ink} strokeWidth="1.7" />
          <path {...ink} strokeWidth="1.5" d="M70 64.5 V70 L74 72.5" />
        </g>
        <g className="nmd-doodle-spool">
          <circle cx="90" cy="70" r="6" {...ink} strokeWidth="1.7" />
          <path {...ink} strokeWidth="1.5" d="M90 64.5 V70 L86 72.5" />
        </g>
        {/* tape between spools */}
        <path {...ink} strokeWidth="1.4" d="M76 70 C80 68.5 81 71.5 84 70" opacity="0.6" />
        {/* knobs + buttons */}
        <circle cx="30" cy="46" r="3.4" {...ink} strokeWidth="1.6" />
        <circle cx="42" cy="46" r="3.4" {...ink} strokeWidth="1.6" />
        <path {...ink} strokeWidth="1.6" d="M58 44 h8 M70 44 h8 M82 44 h8" />
        {/* feet */}
        <path {...ink} strokeWidth="1.8" d="M30 105 l-2 5 M130 105 l2 5" />
      </g>
    </svg>
  );
}

/* A candle that burns down with the Pomodoro: `progress` (1 -> 0) sets the
   wax height, the flame flickers while running, smoke squiggles when done. */
export function DoodleCandle({ progress = 1, phase = 'idle', running = false, size = 64, className = '' }) {
  const p = Math.max(0.08, Math.min(1, progress));
  const t = 62 - p * 38; // wax top: 24 when full, ~59 when burnt down
  const showFlame = phase !== 'done';
  return (
    <svg className={'nmd-doodle ' + className} width={size} height={Math.round(size * 1.25)} viewBox="0 0 64 80" aria-hidden="true">
      <g transform="rotate(-1.5 32 60)">
        {/* holder dish + base */}
        <path {...ink} d="M18 66 C17 67 16 70 19 71 C24 73 40 73 45 71 C48 70 47 67 46 66" />
        <path {...ink} strokeWidth="1.8" d="M22 74 C28 75.5 36 75.5 42 74" opacity="0.6" />
        {/* wax body with a wobbly melted top */}
        <path {...ink} d={`M24 ${t} C23 ${t + 2} 23.5 64 25 66 L39 66 C40.5 64 41 ${t + 2} 40 ${t} C36 ${t + 1.6} 28 ${t - 1.4} 24 ${t} Z`} />
        {/* drip down the side mid-burn */}
        {p > 0.15 && p < 0.9 && (
          <path {...ink} strokeWidth="1.5" d={`M40 ${t + 3} C41.5 ${t + 5} 41.5 ${t + 8} 40 ${t + 9}`} opacity="0.55" />
        )}
        {/* wick */}
        <path {...ink} strokeWidth="1.6" d={`M32 ${t - 1} C32.6 ${t - 2.5} 31.4 ${t - 3.5} 32 ${t - 5}`} />
        {showFlame ? (
          <g
            className={running ? 'candle-flame-flicker' : ''}
            style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
          >
            <path {...ink} stroke="var(--accent-rose)" d={`M32 ${t - 5} C27.5 ${t - 9} 28.5 ${t - 15} 32 ${t - 18} C35.5 ${t - 15} 36.5 ${t - 9} 32 ${t - 5} Z`} />
            <circle cx="32" cy={t - 9.5} r="1.4" fill="var(--accent-rose)" stroke="none" opacity="0.7" />
          </g>
        ) : (
          <g className="nmd-doodle-steam">
            <path {...ink} strokeWidth="1.8" d={`M31 ${t - 6} C29 ${t - 10} 33 ${t - 12} 31 ${t - 16}`} />
            <path {...ink} strokeWidth="1.8" d={`M35 ${t - 8} C33 ${t - 11} 37 ${t - 13} 35 ${t - 17}`} opacity="0.6" />
          </g>
        )}
      </g>
    </svg>
  );
}

/* A sleepy crescent moon with a tiny sparkle, for the sleep timer. */
export function DoodleMoon({ size = 20, className = '' }) {
  return (
    <svg className={'nmd-doodle ' + className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path {...ink} strokeWidth="1.8" d="M14 3 C8 5 5 11 8 16 C10 20 15 21 19 19 C12 19 8 11 14 3 Z" transform="rotate(-8 12 12)" />
      <path {...ink} strokeWidth="1.4" d="M19 3.4 v3.2 M17.4 5 h3.2" opacity="0.7" />
    </svg>
  );
}

/* A single floating eighth note, for page margins. */
export function DoodleNote({ size = 26, className = '' }) {
  return (
    <svg className={'nmd-doodle ' + className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <g transform="rotate(6 16 16)">
        <path {...ink} strokeWidth="1.9" d="M13 23 V8 C16 9 20 8 21 6 C21 9 21 17 21 21" />
        <path {...ink} strokeWidth="1.9" d="M13 23 C13 26 8 27 7 24 C6 22 10 20 13 23 Z" />
        <path {...ink} strokeWidth="1.9" d="M21 21 C21 24 16 25 15 22 C14 20 18 18 21 21 Z" />
      </g>
    </svg>
  );
}

/* A sketchy oval ring, used to circle a word like a margin note. */
export function DoodleRing({ className = '' }) {
  return (
    <svg className={'nmd-doodle-ring ' + className} viewBox="0 0 120 48" preserveAspectRatio="none" aria-hidden="true">
      <path {...ink} strokeWidth="2.6" stroke="var(--accent-blue)" opacity="0.85"
        d="M28 8 C58 2 108 4 112 20 C115 36 78 44 48 43 C20 42 4 34 6 22 C8 12 24 7 44 6" />
    </svg>
  );
}
