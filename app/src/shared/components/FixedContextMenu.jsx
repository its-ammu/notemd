import React, { useLayoutEffect, useRef, useState } from 'react';

/** Right-click menu pinned inside the viewport after measuring actual size. */
export default function FixedContextMenu({ x, y, className = 'nmd-menu', children, onClick }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 8;
    const { width, height } = el.getBoundingClientRect();
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
