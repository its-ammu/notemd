import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PRIO } from '../utils/constants';
import { fmtDate, addDays } from '../utils/time';
import DatePicker from './DatePicker';
import PageLinkPicker from './PageLinkPicker';

export default function TaskDialog({ task, dateKey, onUpdate, onDelete, onMove, onClose, notebooks, onNavigateToPage, pomoStats }) {
  const [pickerPos, setPickerPos] = useState(null);
  const pickerBtnRef = useRef(null);
  const pickerRef = useRef(null);

  const moveBy = (days) => {
    if (!dateKey || !onMove) return;
    const base = new Date(dateKey + 'T00:00:00');
    const target = fmtDate(addDays(base, days));
    if (target === dateKey) return;
    onMove(target);
  };

  const todayKey = fmtDate(new Date());
  const showPicker = pickerPos !== null;

  const openPicker = () => {
    const btn = pickerBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const W = 240, H = 260, margin = 8;
    let left = r.right - W;
    if (left < margin) left = margin;
    if (left + W > window.innerWidth - margin) left = window.innerWidth - W - margin;
    let top = r.bottom + 6;
    if (top + H > window.innerHeight - margin) top = r.top - H - 6;
    setPickerPos({ top, left });
  };
  const closePicker = () => setPickerPos(null);

  useEffect(() => {
    if (!showPicker) return;
    const onDown = (e) => {
      if (pickerRef.current?.contains(e.target)) return;
      if (pickerBtnRef.current?.contains(e.target)) return;
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

  const updateSubtask = (id, patch) => {
    const subs = task.subtasks.map(s => s.id === id ? { ...s, ...patch } : s);
    const allDone = subs.length > 0 && subs.every(s => s.done);
    onUpdate({ subtasks: subs, done: allDone });
  };

  const addSubtask = () => {
    const id = crypto.randomUUID();
    onUpdate({ subtasks: [...task.subtasks, { id, text: '', done: false, _editing: true }] });
  };

  return (
    <div className="nmd-modal-backdrop" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="nmd-modal" onClick={e => e.stopPropagation()} style={{ width: 440 }}>
        <div className="nmd-modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <h2 style={{ fontSize: 13, color: 'var(--fg3)', fontWeight: 500 }}>Edit Task</h2>
          <button className="nmd-iconbtn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="nmd-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <textarea
            autoFocus
            value={task.title}
            onChange={e => onUpdate({ title: e.target.value })}
            style={{
              width: '100%', border: 'none', background: 'transparent', outline: 'none',
              fontSize: 16, color: 'var(--fg1)', fontWeight: 500, resize: 'none',
              minHeight: 40, fontFamily: 'var(--font-sans)', lineHeight: 1.5
            }}
            placeholder="Task title"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--fg3)', width: 60 }}>Priority</span>
            <div className="nmd-menu-swatches" style={{ padding: 0 }}>
              {['high', 'med', 'low', 'none'].map(p => (
                <button
                  key={p}
                  className={task.priority === p ? 'sel' : ''}
                  style={{
                    background: PRIO[p].color, width: 18, height: 18, borderRadius: '50%', cursor: 'pointer',
                    border: task.priority === p ? '2px solid var(--fg1)' : '2px solid transparent',
                    opacity: task.priority === p ? 1 : 0.6
                  }}
                  title={PRIO[p].label}
                  onClick={() => onUpdate({ priority: p })}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--fg3)', width: 60 }}>Linked</span>
            <PageLinkPicker
              notebooks={notebooks || []}
              value={task.linkedPageId}
              onChange={(pageId) => onUpdate({ linkedPageId: pageId })}
              onNavigate={onNavigateToPage}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--fg3)' }}>Subtasks</span>
            <div className="nmd-subtasks" style={{ margin: 0 }}>
              {task.subtasks.map(s => (
                <div key={s.id} className={'nmd-subtask' + (s.done ? ' done' : '')} style={{ display: 'flex', alignItems: 'center' }}>
                  <button className={'nmd-check' + (s.done ? ' checked' : '')} onClick={() => updateSubtask(s.id, { done: !s.done })}>
                    {s.done && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 12l5 5L20 6" /></svg>}
                  </button>
                  <input
                    value={s.text}
                    onChange={e => updateSubtask(s.id, { text: e.target.value, _editing: false })}
                    onKeyDown={e => { if (e.key === 'Enter') addSubtask(); }}
                    className="nmd-subtask-text"
                    style={{
                      border: 'none', outline: 'none', background: 'transparent', flex: 1,
                      fontFamily: 'inherit', fontSize: 13, color: s.done ? 'var(--fg4)' : 'var(--fg1)'
                    }}
                    ref={el => { if (el && s._editing) el.focus(); }}
                    placeholder="New subtask"
                  />
                  <button
                    className="nmd-subtask-delete"
                    style={{ opacity: 1 }}
                    onClick={() => onUpdate({ subtasks: task.subtasks.filter(x => x.id !== s.id) })}
                  >×</button>
                </div>
              ))}
              <button className="nmd-subtask-add" onClick={addSubtask} style={{ margin: '4px 0 0 0', width: 'fit-content' }}>+ add subtask</button>
            </div>
          </div>
        </div>

        {onMove && dateKey && (
          <div className="nmd-task-move">
            <span className="nmd-task-move-label">Move</span>
            <button className="nmd-icon-chip" onClick={() => moveBy(1)} title="Tomorrow">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
              </svg>
              <span>+1</span>
            </button>
            <button className="nmd-icon-chip" onClick={() => moveBy(7)} title="Next week">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h14" /><path d="m11 6 6 6-6 6" /><path d="M20 6v12" />
              </svg>
              <span>+7</span>
            </button>
            <button
              ref={pickerBtnRef}
              className={'nmd-icon-chip' + (showPicker ? ' active' : '')}
              onClick={() => showPicker ? closePicker() : openPicker()}
              title="Pick date"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 9h18M8 3v4M16 3v4" />
              </svg>
            </button>
          </div>
        )}

        {showPicker && onMove && dateKey && createPortal(
          <div
            ref={pickerRef}
            className="nmd-dp-overlay"
            style={{ top: pickerPos.top, left: pickerPos.left }}
            onMouseDown={e => e.stopPropagation()}
          >
            <DatePicker
              value={dateKey}
              minKey={todayKey}
              onChange={(k) => { closePicker(); if (k !== dateKey) onMove(k); }}
            />
          </div>,
          document.body
        )}

        {(() => {
          const s = pomoStats?.byTask?.[task.id];
          return s?.sessions > 0 ? (
            <div className="nmd-task-pomo-row">
              <span className="nmd-task-pomo-row-stats">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2c0 0 3.5 3.5 1.5 6.5-.5.8-1.5 1-1.5 1s-1-.2-1.5-1C8.5 5.5 12 2 12 2z"/>
                  <line x1="12" y1="9.5" x2="12" y2="12"/>
                  <rect x="7" y="12" width="10" height="8" rx="1"/>
                </svg>
                {s.sessions} {s.sessions === 1 ? 'session' : 'sessions'} · {s.mins >= 60 ? `${(s.mins / 60).toFixed(1)}h` : `${s.mins}m`} scribbled
              </span>
            </div>
          ) : null;
        })()}

        <div className="nmd-task-footer">
          <button
            className="nmd-icon-chip danger"
            onClick={() => { onDelete(); onClose(); }}
            title="Delete task"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" />
            </svg>
          </button>
          <button
            onClick={onClose}
            style={{ background: 'var(--fg1)', color: 'var(--bg)', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
          >Done</button>
        </div>
      </div>
    </div>
  );
}
