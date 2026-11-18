import React from 'react';

/* Shown while auth and data load: the outline of the app, drawn faintly,
   so the real UI fades in over the same shapes instead of replacing a
   "Loading…" card. */
export default function LoadingShell({ label = 'Opening your notebook…' }) {
  return (
    <div className="nmd-loading-shell" role="status" aria-live="polite">
      <div className="nmd-loading-rail" aria-hidden="true">
        {[0, 1, 2, 3].map(i => <span key={i} className="nmd-skel nmd-skel-dot" />)}
      </div>
      <div className="nmd-loading-main" aria-hidden="true">
        <div className="nmd-loading-head">
          <span className="nmd-skel" style={{ width: 160, height: 14 }} />
          <span className="nmd-skel" style={{ width: 90, height: 14, marginLeft: 'auto' }} />
        </div>
        <div className="nmd-loading-sheet">
          {[72, 55, 64, 40, 58, 30].map((w, i) => (
            <div key={i} className="nmd-loading-line">
              <span className="nmd-skel nmd-skel-box" />
              <span className="nmd-skel" style={{ width: `${w}%`, height: 10 }} />
            </div>
          ))}
        </div>
      </div>
      <span className="nmd-loading-label">{label}</span>
    </div>
  );
}
