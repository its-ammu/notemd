import React, { useState } from 'react';
import { parseYouTubeVideoId } from '../utils/youtube';

export default function CustomRadioDialog({ station, onSave, onClose }) {
  const editing = !!station;
  const [name, setName] = useState(station?.name || '');
  const [url, setUrl] = useState(station?.videoId || '');
  const [sub, setSub] = useState(station?.sub || '');
  const [by, setBy] = useState(station?.by || '');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const videoId = parseYouTubeVideoId(url);
    if (!videoId) {
      setError('Paste a YouTube link or 11-character video id.');
      return;
    }
    if (!name.trim()) {
      setError('Give your station a name.');
      return;
    }
    onSave({
      name: name.trim(),
      videoId,
      sub: sub.trim() || 'custom stream',
      by: by.trim() || 'you',
    });
    onClose();
  };

  return (
    <div className="nmd-modal-backdrop" onClick={onClose}>
      <div className="nmd-modal nmd-modal-settings" onClick={e => e.stopPropagation()}>
        <div className="nmd-modal-header">
          <h2>{editing ? 'Edit custom radio' : 'Add custom radio'}</h2>
          <button type="button" className="nmd-iconbtn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <form className="nmd-modal-body" onSubmit={submit}>
          <div className="nmd-modal-row nmd-modal-row-field">
            <label className="nmd-field" htmlFor="nmd-radio-name">
              <span className="nmd-field-label">Name</span>
              <span className="nmd-field-hint">What shows on the station card.</span>
              <input
                id="nmd-radio-name"
                className="nmd-field-input"
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                placeholder="My chill stream"
                autoFocus
              />
            </label>
          </div>
          <div className="nmd-modal-row nmd-modal-row-field">
            <label className="nmd-field" htmlFor="nmd-radio-url">
              <span className="nmd-field-label">YouTube link or video id</span>
              <span className="nmd-field-hint">Live streams, videos, or /live pages all work.</span>
              <input
                id="nmd-radio-url"
                className="nmd-field-input"
                type="text"
                value={url}
                onChange={e => { setUrl(e.target.value); setError(''); }}
                placeholder="https://youtube.com/watch?v=…"
              />
            </label>
          </div>
          <div className="nmd-modal-row nmd-modal-row-field">
            <label className="nmd-field" htmlFor="nmd-radio-sub">
              <span className="nmd-field-label">Subtitle <span className="nmd-field-optional">optional</span></span>
              <input
                id="nmd-radio-sub"
                className="nmd-field-input"
                type="text"
                value={sub}
                onChange={e => setSub(e.target.value)}
                placeholder="beats to code to"
              />
            </label>
          </div>
          <div className="nmd-modal-row nmd-modal-row-field">
            <label className="nmd-field" htmlFor="nmd-radio-by">
              <span className="nmd-field-label">Credit <span className="nmd-field-optional">optional</span></span>
              <input
                id="nmd-radio-by"
                className="nmd-field-input"
                type="text"
                value={by}
                onChange={e => setBy(e.target.value)}
                placeholder="channel name"
              />
            </label>
          </div>
          {error && <p className="nmd-radio-form-error">{error}</p>}
          <div className="nmd-radio-form-actions">
            <button type="button" className="nmd-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="nmd-btn primary">{editing ? 'Save' : 'Add station'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
