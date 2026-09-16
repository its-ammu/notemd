import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PageLinkPicker from '../../shared/components/PageLinkPicker';
import { addDays, fmtDate } from '../../shared/utils/time';
import DatePicker from './DatePicker';

const REPEAT_OPTIONS = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Every weekday' },
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
];

function formatDayLabel(key) {
  if (!key) return 'Pick a day';
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function lastDayFromExclusive(endDate) {
  if (!endDate) return null;
  return fmtDate(addDays(new Date(endDate + 'T00:00:00'), -1));
}

function exclusiveFromLastDay(lastKey) {
  if (!lastKey) return null;
  return fmtDate(addDays(new Date(lastKey + 'T00:00:00'), 1));
}

export default function MeetingDialog({ meeting, dateKey, onUpdate, onDelete, onDeleteOccurrence, onDeleteFuture, onClose, notebooks, onNavigateToPage }) {
  const [title, setTitle] = useState(meeting.title);
  const [day, setDay] = useState(dateKey);
  const [time, setTime] = useState(meeting.time || '');
  const [duration, setDuration] = useState(meeting.duration || '30');
  const [repeat, setRepeat] = useState(meeting.repeat || 'none');
  const [endLast, setEndLast] = useState(() => lastDayFromExclusive(meeting.endDate));
  const [notes, setNotes] = useState(meeting.notes || '');
  const [linkedPageId, setLinkedPageId] = useState(meeting.linkedPageId || null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [pickerPos, setPickerPos] = useState(null);
  const dayBtnRef = useRef(null);
  const endBtnRef = useRef(null);
  const pickerRef = useRef(null);

  const isRecurringInstance = meeting.id && (meeting._recurring || (meeting.repeat && meeting.repeat !== 'none'));
  const isGhost = Boolean(meeting._recurring);
  const repeats = repeat && repeat !== 'none';
  const showPicker = pickerFor !== null;

  const openPicker = (which) => {
    const btn = which === 'end' ? endBtnRef.current : dayBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const W = 240, H = 260, margin = 8;
    let left = r.left;
    if (left + W > window.innerWidth - margin) left = window.innerWidth - W - margin;
    if (left < margin) left = margin;
    let top = r.bottom + 6;
    if (top + H > window.innerHeight - margin) top = r.top - H - 6;
    setPickerPos({ top, left });
    setPickerFor(which);
  };
  const closePicker = () => { setPickerFor(null); setPickerPos(null); };

  useEffect(() => {
    if (!showPicker) return;
    const onDown = (e) => {
      if (pickerRef.current?.contains(e.target)) return;
      if (dayBtnRef.current?.contains(e.target)) return;
      if (endBtnRef.current?.contains(e.target)) return;
      closePicker();
    };
    const onKey = (e) => { if (e.key === 'Escape') closePicker(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showPicker]);

  const setRepeatValue = (value) => {
    setRepeat(value);
    if (value === 'none') setEndLast(null);
  };

  const setMeetingDay = (k) => {
    setDay(k);
    if (endLast && endLast < k) setEndLast(k);
  };

  const save = () => {
    onUpdate(
      {
        title: title.trim() || 'Untitled meeting',
        time,
        duration,
        repeat,
        notes,
        linkedPageId,
        endDate: repeats ? exclusiveFromLastDay(endLast) : null,
      },
      day,
    );
    onClose();
  };

  return (
    <>
    <div
      className="nmd-modal-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ zIndex: 1000 }}
    >
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="nmd-mtg-field-label">Date</span>
            <button
              ref={dayBtnRef}
              type="button"
              className={'nmd-mtg-input nmd-mtg-date-btn' + (pickerFor === 'day' ? ' open' : '')}
              onClick={() => pickerFor === 'day' ? closePicker() : openPicker('day')}
              aria-label="Change meeting date"
            >
              <span>{formatDayLabel(day)}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 9h18M8 3v4M16 3v4" />
              </svg>
            </button>
            {isGhost && day !== dateKey && (
              <span className="nmd-mtg-date-hint">Only this occurrence moves. The rest of the series stays put.</span>
            )}
            {!isGhost && isRecurringInstance && day !== dateKey && (
              <span className="nmd-mtg-date-hint">Moves the start of the whole series.</span>
            )}
          </div>

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
                  onClick={() => setRepeatValue(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {repeats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="nmd-mtg-field-label">Ends</span>
              <div className="nmd-mtg-ends-row">
                <button
                  type="button"
                  className={'nmd-mtg-repeat-btn' + (!endLast ? ' active' : '')}
                  onClick={() => { setEndLast(null); if (pickerFor === 'end') closePicker(); }}
                >
                  Never
                </button>
                <button
                  ref={endBtnRef}
                  type="button"
                  className={'nmd-mtg-input nmd-mtg-date-btn' + (pickerFor === 'end' ? ' open' : '')}
                  onClick={() => pickerFor === 'end' ? closePicker() : openPicker('end')}
                  aria-label="Last day of the series"
                >
                  <span>{endLast ? formatDayLabel(endLast) : 'On a day'}</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 9h18M8 3v4M16 3v4" />
                  </svg>
                </button>
              </div>
              {endLast && (
                <span className="nmd-mtg-date-hint">Last occurrence on this day.</span>
              )}
            </div>
          )}

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
      {showPicker && createPortal(
        <div
          ref={pickerRef}
          className="nmd-dp-overlay"
          style={{ top: pickerPos.top, left: pickerPos.left }}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <DatePicker
            value={pickerFor === 'end' ? (endLast || day) : day}
            minKey={pickerFor === 'end' ? day : undefined}
            onChange={(k) => {
              if (pickerFor === 'end') setEndLast(k);
              else setMeetingDay(k);
              closePicker();
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
}
