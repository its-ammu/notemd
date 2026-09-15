import React, { useState } from 'react';
import PageLinkPicker from '../../shared/components/PageLinkPicker';

const REPEAT_OPTIONS = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Every weekday' },
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
];

export default function MeetingDialog({ meeting, onUpdate, onDelete, onDeleteOccurrence, onDeleteFuture, onClose, notebooks, onNavigateToPage }) {
  const [title, setTitle] = useState(meeting.title);
  const [time, setTime] = useState(meeting.time || '');
  const [duration, setDuration] = useState(meeting.duration || '30');
  const [repeat, setRepeat] = useState(meeting.repeat || 'none');
  const [notes, setNotes] = useState(meeting.notes || '');
  const [linkedPageId, setLinkedPageId] = useState(meeting.linkedPageId || null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isRecurringInstance = meeting.id && (meeting._recurring || (meeting.repeat && meeting.repeat !== 'none'));

  const save = () => {
    onUpdate({ title: title.trim() || 'Untitled meeting', time, duration, repeat, notes, linkedPageId });
    onClose();
  };

  return (
    <div className="nmd-modal-backdrop" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="nmd-modal" onClick={e => e.stopPropagation()} style={{ width: 420 }}>
        <div className="nmd-modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <h2 style={{ fontSize: 13, color: 'var(--fg3)', fontWeight: 500 }}>
            {meeting.id ? 'Edit Meeting' : 'New Meeting'}
          </h2>
          <button className="nmd-iconbtn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="nmd-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); }}
            style={{
              width: '100%', border: 'none', background: 'transparent', outline: 'none',
              fontSize: 16, color: 'var(--fg1)', fontWeight: 500,
              fontFamily: 'var(--font-sans)', lineHeight: 1.5
            }}
            placeholder="Meeting title"
          />

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <span className="nmd-mtg-field-label">Time</span>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="nmd-mtg-input"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 100 }}>
              <span className="nmd-mtg-field-label">Duration</span>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="nmd-mtg-input"
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hr</option>
                <option value="90">1.5 hr</option>
                <option value="120">2 hr</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="nmd-mtg-field-label">Repeat</span>
            <div className="nmd-mtg-repeat-row">
              {REPEAT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={'nmd-mtg-repeat-btn' + (repeat === opt.value ? ' active' : '')}
                  onClick={() => setRepeat(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="nmd-mtg-field-label">Notes</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Agenda, links, etc."
              className="nmd-mtg-input"
              style={{ minHeight: 56, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="nmd-mtg-field-label">Linked page</span>
            <PageLinkPicker
              notebooks={notebooks || []}
              value={linkedPageId}
              onChange={setLinkedPageId}
              onNavigate={onNavigateToPage}
            />
          </div>
        </div>

        <div className="nmd-task-footer">
          {!meeting.id ? <span /> : confirmingDelete ? (
            <div className="nmd-mtg-delete-row">
              <span className="nmd-mtg-delete-label">Delete</span>
              {isRecurringInstance && (
                <button
                  className="nmd-icon-chip"
                  onClick={() => { onDeleteOccurrence(); onClose(); }}
                  title="Only this occurrence"
                  aria-label="Delete only this occurrence"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 9h18M8 3v4M16 3v4" />
                    <path d="M9 14l6 0" />
                  </svg>
                </button>
              )}
              {isRecurringInstance && (
                <button
                  className="nmd-icon-chip"
                  onClick={() => { onDeleteFuture(); onClose(); }}
                  title="This and future occurrences"
                  aria-label="Delete this and future occurrences"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 9h18M8 3v4M16 3v4" />
                    <path d="m10 14 3 2-3 2" />
                  </svg>
                </button>
              )}
              <button
                className="nmd-icon-chip danger"
                onClick={() => { onDelete(); onClose(); }}
                title={isRecurringInstance ? 'Entire series' : 'Delete meeting'}
                aria-label={isRecurringInstance ? 'Delete entire series' : 'Delete meeting'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
              <button
                className="nmd-icon-chip ghost"
                onClick={() => setConfirmingDelete(false)}
                title="Cancel"
                aria-label="Cancel"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              className="nmd-icon-chip danger"
              onClick={() => { if (isRecurringInstance) setConfirmingDelete(true); else { onDelete(); onClose(); } }}
              title="Delete"
              aria-label="Delete"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          )}
          <button
            onClick={save}
            style={{ background: 'var(--fg1)', color: 'var(--bg)', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
          >Save</button>
        </div>
      </div>
    </div>
  );
}
