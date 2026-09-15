import React from 'react';

/** Left margin rail for home link rows — tab chip, clock, or task control. */
export default function HomeListRail({ variant, color, children }) {
  const decorative = variant === 'page' || variant === 'meeting';
  return (
    <span className="nmd-home-rail" aria-hidden={decorative || undefined}>
      {variant === 'page' && (
        <span
          className="nmd-home-rail-tab"
          style={{ '--home-tab-color': color || 'var(--accent-blue)' }}
        />
      )}
      {variant === 'meeting' && (
        <svg
          className="nmd-home-rail-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* wobbly hand-drawn clock, kin to DoodleClock */}
          <path d="M12 3.5 C16.8 3.2 20.6 7.4 20.2 12.2 C19.8 16.9 16.4 20.7 11.7 20.3 C7.1 19.9 3.6 16 4 11.4 C4.4 6.8 7.7 3.9 12 3.5 Z" />
          <path d="M12 8 L11.9 12.4 L15 14.2" />
        </svg>
      )}
      {variant === 'task' && children}
    </span>
  );
}
