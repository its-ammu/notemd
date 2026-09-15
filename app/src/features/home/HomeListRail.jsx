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
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v4.5l2.75 1.75" />
        </svg>
      )}
      {variant === 'task' && children}
    </span>
  );
}
