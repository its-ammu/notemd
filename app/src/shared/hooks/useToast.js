import { useRef, useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (text, opts = {}) => {
    clearTimeout(toastTimer.current);
    setToast({ text, type: opts.type || 'info', action: opts.action || null });
    toastTimer.current = setTimeout(() => setToast(null), opts.duration ?? (opts.action ? 5000 : 1800));
  };

  const dismissToast = () => {
    clearTimeout(toastTimer.current);
    setToast(null);
  };

  return { toast, showToast, dismissToast };
}
