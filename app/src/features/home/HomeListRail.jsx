import React from 'react';
import { DoodleClockMini } from '../../shared/components/Doodles';

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
        <DoodleClockMini size={16} className="nmd-home-rail-icon" />
      )}
      {variant === 'task' && children}
    </span>
  );
}
