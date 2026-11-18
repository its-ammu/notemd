import React, { useLayoutEffect, useRef, useState } from 'react';

/** Right-click menu pinned inside the viewport after measuring actual size. */
export default function FixedContextMenu({ x, y, className = 'nmd-menu', children, onClick }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 8;
    // Layout size, not getBoundingClientRect: the menu scales in as it appears,
    // and a mid-animation rect reads smaller than the menu will end up.
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    setPos({
      left: Math.max(pad, Math.min(x, window.innerWidth - width - pad)),
      top: Math.max(pad, Math.min(y, window.innerHeight - height - pad)),
    });
  }, [x, y, children]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ left: pos.left, top: pos.top }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
