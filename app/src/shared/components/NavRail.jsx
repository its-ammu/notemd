import React from 'react';

function RailBtn({ label, children, active, onClick }) {
  return (
    <button
      className={'nmd-rail-btn' + (active ? ' active' : '')}
      onClick={onClick}
      aria-label={label}
    >
      {children}
      <span className="nmd-tip">{label}</span>
    </button>
  );
}

export default function NavRail({ tab, setTab, radio, onOpenHowTo, onOpenSettings }) {
  return (
      <nav className="nmd-rail">
        <div className="nmd-rail-logo"><span>m</span></div>
        <RailBtn id="home" label="Home" active={tab === 'home'} onClick={() => setTab('home')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
          </svg>
        </RailBtn>
        <RailBtn id="notebooks" label="Notebooks" active={tab === 'notebooks'} onClick={() => setTab('notebooks')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 19.5z" />
            <path d="M4 7.5h16M4 12h16M4 16.5h16" />
          </svg>
        </RailBtn>
        <RailBtn id="tracker" label="Weekly tracker" active={tab === 'tracker'} onClick={() => setTab('tracker')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 3v4M16 3v4" />
            <path d="M7 13h3M13 13h4M7 17h6" strokeWidth="1.2" />
          </svg>
        </RailBtn>
        <RailBtn id="radio" label="Lofi radio" active={tab === 'radio'} onClick={() => setTab('radio')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="9" width="18" height="11" rx="2" />
            <path d="m7.5 9 9-5" />
            <circle cx="9" cy="14.5" r="2.5" />
            <path d="M15 12.5h3M15 16.5h2" />
          </svg>
          {radio.playing && <span className="nmd-rail-live" />}
        </RailBtn>

        <div className="nmd-rail-spacer" />

        <button className="nmd-rail-btn" onClick={onOpenHowTo} aria-label="How to use NoteMD">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2.2" />
            <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
          </svg>
          <span className="nmd-tip">How to use</span>
        </button>

        <button className="nmd-rail-btn" onClick={onOpenSettings} aria-label="Settings & data">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.08a1.7 1.7 0 0 0 1.56-1.03 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.08a1.7 1.7 0 0 0-1.56 1z" />
          </svg>
          <span className="nmd-tip">Settings & data</span>
        </button>
      </nav>
  );
}
