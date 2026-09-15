import React from 'react';
import { formatShareExpiryDate } from './helpers';

export default function ShareDialog({
  page,
  open,
  onClose,
  shareUrl,
  shareBusy,
  shareCopied,
  shareExpiry,
  setShareExpiry,
  shareHideTags,
  setShareHideTags,
  onApplyShare,
  onCopyLink,
}) {
  if (!open || !page) return null;

  return (
    <div className="nmd-modal-backdrop" onClick={onClose}>
      <div className="nmd-modal nmd-share-modal" onClick={e => e.stopPropagation()}>
        <div className="nmd-modal-header">
          <h2>Share page</h2>
          <button className="nmd-iconbtn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="nmd-modal-body">
          <div className="nmd-modal-row">
            <div className="nmd-modal-row-text">
              <div className="nmd-modal-row-title">Public link</div>
              <div className="nmd-modal-row-desc">
                {page.isPublic
                  ? 'Anyone with the link can read this page (no sign-in needed).'
                  : 'Turn on to create a read-only link you can share with anyone.'}
              </div>
            </div>
            <button
              className={'nmd-toggle' + (page.isPublic ? ' on' : '')}
              disabled={shareBusy}
              onClick={() => onApplyShare({ makePublic: !page.isPublic })}
              aria-pressed={page.isPublic}
              aria-label="Toggle public sharing"
            >
              <span className="nmd-toggle-knob" />
            </button>
          </div>
          {page.isPublic && shareUrl && (
            <div className="nmd-share-link">
              <input readOnly value={shareUrl} onFocus={e => e.target.select()} />
              <button className="nmd-btn primary" onClick={onCopyLink}>
                {shareCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
          {page.isPublic && (
            <>
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Link expiry</div>
                  <div className="nmd-modal-row-desc">
                    {page.publicExpiresAt
                      ? `Stops working ${formatShareExpiryDate(page.publicExpiresAt)}.`
                      : 'Link works until you turn sharing off.'}
                  </div>
                </div>
                <select
                  className="nmd-modal-input"
                  value={shareExpiry}
                  disabled={shareBusy}
                  onChange={e => { setShareExpiry(e.target.value); onApplyShare({ expiry: e.target.value }); }}
                >
                  {page.publicExpiresAt && <option value="keep">Keep current</option>}
                  <option value="never">No expiry</option>
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                </select>
              </div>
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Hide tags</div>
                  <div className="nmd-modal-row-desc">Keep this page's tags private from public readers.</div>
                </div>
                <button
                  className={'nmd-toggle' + (shareHideTags ? ' on' : '')}
                  disabled={shareBusy}
                  onClick={() => { const v = !shareHideTags; setShareHideTags(v); onApplyShare({ hideTags: v }); }}
                  aria-pressed={shareHideTags}
                  aria-label="Toggle hide tags"
                >
                  <span className="nmd-toggle-knob" />
                </button>
              </div>
              <p className="nmd-share-note">
                Edits you make sync to the public page automatically. Turn sharing off to revoke access — the same link works again if you re-share.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
