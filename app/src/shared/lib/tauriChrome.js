import { isTauri } from './openExternal';

/**
 * Desktop-shell chrome that WKWebView doesn't give us for free:
 * Cmd/Ctrl+R reloads, and right-click on empty page chrome offers Reload
 * (task/notebook menus still win — they preventDefault first).
 */
export function installTauriChrome() {
  if (!isTauri()) return;

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      window.location.reload();
    }
  });

  let menuEl = null;
  const dismiss = () => {
    menuEl?.remove();
    menuEl = null;
  };

  document.addEventListener('click', dismiss);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismiss(); });

  document.addEventListener('contextmenu', (e) => {
    if (e.defaultPrevented) return;
    if (e.target.closest('.nmd-ctx-menu, .nmd-menu')) return;
    e.preventDefault();
    dismiss();

    const pad = 8;
    menuEl = document.createElement('div');
    menuEl.className = 'nmd-ctx-menu nmd-tauri-chrome-menu';
    menuEl.style.left = `${Math.min(e.clientX, window.innerWidth - 160)}px`;
    menuEl.style.top = `${Math.min(e.clientY, window.innerHeight - 48)}px`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nmd-ctx-item';
    btn.textContent = 'Reload';
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      dismiss();
      window.location.reload();
    });
    menuEl.appendChild(btn);

    const sel = window.getSelection()?.toString();
    if (sel) {
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'nmd-ctx-item';
      copy.textContent = 'Copy';
      copy.addEventListener('click', (ev) => {
        ev.stopPropagation();
        navigator.clipboard.writeText(sel).catch(() => {});
        dismiss();
      });
      menuEl.appendChild(copy);
    }

    document.body.appendChild(menuEl);
    const { width, height } = menuEl.getBoundingClientRect();
    menuEl.style.left = `${Math.max(pad, Math.min(e.clientX, window.innerWidth - width - pad))}px`;
    menuEl.style.top = `${Math.max(pad, Math.min(e.clientY, window.innerHeight - height - pad))}px`;
  });
}
