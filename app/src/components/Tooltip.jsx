import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ tip, children, position = 'bottom' }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!show || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tipWidth = 220;
    const margin = 8;

    let top, left;
    if (position === 'bottom') {
      top = rect.bottom + 6;
      left = rect.left + rect.width / 2 - tipWidth / 2;
    } else if (position === 'top') {
      top = rect.top - 6;
      left = rect.left + rect.width / 2 - tipWidth / 2;
    } else if (position === 'left') {
      top = rect.top + rect.height / 2;
      left = rect.left - tipWidth - 6;
    } else {
      top = rect.top + rect.height / 2;
      left = rect.right + 6;
    }

    // Keep within viewport
    if (left < margin) left = margin;
    if (left + tipWidth > window.innerWidth - margin) left = window.innerWidth - tipWidth - margin;

    setCoords({ top, left });
  }, [show, position]);

  return (
    <>
      <button
        ref={triggerRef}
        className="nmd-tip-trigger"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(v => !v); }}
        aria-label="Help"
        type="button"
      >
        {children || (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.5 1.2-1.5 2.2" />
            <circle cx="12" cy="17" r="0.5" fill="currentColor" />
          </svg>
        )}
      </button>
      {show && createPortal(
        <div
          className={'nmd-tooltip nmd-tooltip-' + position}
          style={{ top: coords.top, left: coords.left }}
        >
          {tip}
        </div>,
        document.body
      )}
    </>
  );
}

export function HelpIcon({ tip, position }) {
  return <Tooltip tip={tip} position={position} />;
}
