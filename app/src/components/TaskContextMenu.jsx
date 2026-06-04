import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function TaskContextMenu({ x, y, onStartPomodoro, onDuplicate, onClose }) {
  const [step, setStep] = useState('menu'); // 'menu' | 'custom'
  const [workMins, setWorkMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') { if (step === 'custom') setStep('menu'); else onClose(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, step]);

  const menuW = 192;
  const menuH = step === 'custom' ? 170 : 112;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - menuH - 8);

  const startCustom = () => {
    const w = Math.max(1, Math.min(120, workMins || 25));
    const b = Math.max(1, Math.min(60, breakMins || 5));
    onStartPomodoro(w * 60, b * 60);
    onClose();
  };

  return createPortal(
    <div ref={ref} className="nmd-ctx-menu" style={{ left, top }} onClick={e => e.stopPropagation()}>
      {step === 'menu' ? (
        <>
          <button className="nmd-ctx-item" onClick={(e) => { e.stopPropagation(); onStartPomodoro(25 * 60, 5 * 60); onClose(); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2c0 0 3.5 3.5 1.5 6.5-.5.8-1.5 1-1.5 1s-1-.2-1.5-1C8.5 5.5 12 2 12 2z" />
              <line x1="12" y1="9.5" x2="12" y2="12" />
              <rect x="7" y="12" width="10" height="8" rx="1" />
            </svg>
            Start Pomo
          </button>
          <button className="nmd-ctx-item" onClick={(e) => { e.stopPropagation(); setStep('custom'); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            Custom Pomo
          </button>
          <button className="nmd-ctx-item" onClick={(e) => { e.stopPropagation(); onDuplicate(); onClose(); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Duplicate
          </button>
        </>
      ) : (
        <div className="nmd-ctx-custom">
          <div className="nmd-ctx-custom-fields">
            <div className="nmd-ctx-custom-field">
              <span className="nmd-ctx-custom-label">Work (min)</span>
              <input
                autoFocus
                type="number"
                min={1}
                max={120}
                value={workMins}
                onChange={e => setWorkMins(Number(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') startCustom(); }}
                className="nmd-ctx-input"
              />
            </div>
            <div className="nmd-ctx-custom-field">
              <span className="nmd-ctx-custom-label">Break (min)</span>
              <input
                type="number"
                min={1}
                max={60}
                value={breakMins}
                onChange={e => setBreakMins(Number(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') startCustom(); }}
                className="nmd-ctx-input"
              />
            </div>
          </div>
          <div className="nmd-ctx-custom-row">
            <button className="nmd-ctx-item nmd-ctx-back" onClick={e => { e.stopPropagation(); setStep('menu'); }}>
              ←
            </button>
            <button className="nmd-ctx-item nmd-ctx-start" onClick={e => { e.stopPropagation(); startCustom(); }}>
              Start
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
