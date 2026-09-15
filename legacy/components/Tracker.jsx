// Weekly tracker — Mon-Sun columns, tasks with subtasks, priority, drag between days, copy-day

const PRIO = {
  high: { label: 'High',   color: '#CD2C54', cls: 'prio-high' },
  med:  { label: 'Medium', color: '#C89EF4', cls: 'prio-med'  },
  low:  { label: 'Low',    color: '#5167F4', cls: 'prio-low'  },
  none: { label: 'None',   color: '#bbbbbb', cls: 'prio-none' },
};

const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function startOfWeek(d) {
  const date = new Date(d);
  date.setHours(0,0,0,0);
  const day = date.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  return date;
}
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function fmtDate(d) { return d.toISOString().slice(0,10); }
function fmtRange(start) {
  const end = addDays(start, 6);
  const sm = start.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  const em = end.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  return `${sm} – ${em}`;
}
function weekKey(start) {
  // ISO-ish "YYYY-Www" derived from Monday start
  const y = start.getFullYear();
  const onejan = new Date(y, 0, 1);
  const w = Math.ceil((((start - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${y}-W${String(w).padStart(2,'0')}`;
}

function Task({ task, onUpdate, onDelete, onDragStart, onDragEnd, dragging }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({x:0, y:0});
  const doneCount = task.subtasks.filter(s => s.done).length;
  const hasSubs = task.subtasks.length > 0;

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  const toggleDone = () => {
    // If all subtasks exist, mark them too
    if (hasSubs && !task.done) {
      onUpdate({ done: true, subtasks: task.subtasks.map(s => ({ ...s, done: true })) });
    } else if (hasSubs && task.done) {
      onUpdate({ done: false, subtasks: task.subtasks.map(s => ({ ...s, done: false })) });
    } else {
      onUpdate({ done: !task.done });
    }
  };

  const updateSubtask = (id, patch) => {
    const subs = task.subtasks.map(s => s.id === id ? { ...s, ...patch } : s);
    const allDone = subs.length > 0 && subs.every(s => s.done);
    onUpdate({ subtasks: subs, done: allDone });
  };

  const addSubtask = () => {
    const id = 's' + Date.now();
    onUpdate({ subtasks: [...task.subtasks, { id, text: '', done: false, _editing: true }] });
  };

  const cls = 'nmd-task ' + PRIO[task.priority || 'none'].cls + (task.done ? ' done' : '') + (dragging ? ' dragging' : '');
  return (
    <div
      className={cls}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuPos({x: e.clientX, y: e.clientY});
        setMenuOpen(true);
      }}
    >
      <div className="nmd-task-row">
        <button
          className={'nmd-check' + (task.done ? ' checked' : '')}
          onClick={toggleDone}
          title={task.done ? 'Mark not done' : 'Mark done'}
        >
          {task.done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 12l5 5L20 6"/></svg>}
        </button>
        <div
          className="nmd-task-title"
          contentEditable
          suppressContentEditableWarning
          onBlur={e => onUpdate({ title: e.target.textContent })}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
          }}
        >
          {task.title}
        </div>
      </div>
      {hasSubs && (
        <React.Fragment>
          <div className="nmd-subtasks">
            {task.subtasks.map(s => (
              <div key={s.id} className={'nmd-subtask' + (s.done ? ' done' : '')}>
                <button
                  className={'nmd-check' + (s.done ? ' checked' : '')}
                  onClick={() => updateSubtask(s.id, { done: !s.done })}
                >
                  {s.done && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 12l5 5L20 6"/></svg>}
                </button>
                <span
                  className="nmd-subtask-text"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => {
                    const text = e.target.textContent.trim();
                    if (!text) {
                      onUpdate({ subtasks: task.subtasks.filter(x => x.id !== s.id) });
                    } else {
                      updateSubtask(s.id, { text, _editing: false });
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
                    if (e.key === 'Escape') e.target.blur();
                  }}
                  ref={el => { if (el && s._editing) { el.focus(); } }}
                >{s.text}</span>
                <button className="nmd-subtask-delete" title="Remove"
                  onClick={() => onUpdate({ subtasks: task.subtasks.filter(x => x.id !== s.id) })}>×</button>
              </div>
            ))}
          </div>
          <div className="nmd-task-progress">
            <div className="nmd-task-progress-fill" style={{width: (doneCount / task.subtasks.length * 100) + '%'}}/>
          </div>
        </React.Fragment>
      )}
      <div className="nmd-task-meta">
        {task.priority && task.priority !== 'none' && (
          <React.Fragment>
            <span className={'nmd-task-prio-dot nmd-' + PRIO[task.priority].cls}/>
            <span>{PRIO[task.priority].label}</span>
            <span style={{color:'var(--fg5)'}}>·</span>
          </React.Fragment>
        )}
        <button
          className="nmd-subtask-add"
          onClick={addSubtask}
          style={{margin:0, padding:0, fontSize:11}}
        >+ subtask</button>
        {hasSubs && <span style={{color:'var(--fg5)'}}>·</span>}
        {hasSubs && <span>{doneCount}/{task.subtasks.length}</span>}
      </div>

      {menuOpen && (
        <div className="nmd-menu" style={{left: menuPos.x, top: menuPos.y}} onClick={e => e.stopPropagation()}>
          <div className="nmd-menu-label">Priority</div>
          <div className="nmd-menu-swatches">
            {['high','med','low','none'].map(p => (
              <button
                key={p}
                className={task.priority === p ? 'sel' : ''}
                style={{background: PRIO[p].color}}
                title={PRIO[p].label}
                onClick={() => { onUpdate({ priority: p }); setMenuOpen(false); }}
              />
            ))}
          </div>
          <hr/>
          <button onClick={() => { addSubtask(); setMenuOpen(false); }}>Add subtask</button>
          <button onClick={() => { onUpdate({ done: !task.done }); setMenuOpen(false); }}>
            {task.done ? 'Mark not done' : 'Mark done'}
          </button>
          <hr/>
          <button className="danger" onClick={() => { onDelete(); setMenuOpen(false); }}>Delete task</button>
        </div>
      )}
    </div>
  );
}

function DayColumn({ dayIdx, date, tasks, isToday, isWeekend, onAddTask, onUpdateTask, onDeleteTask, onDropTask, onDragStart, onDragEnd, draggingId, showToast }) {
  const [adding, setAdding] = React.useState(false);
  const [addText, setAddText] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  const submitAdd = () => {
    const t = addText.trim();
    if (t) onAddTask(t);
    setAddText(''); setAdding(false);
  };

  const copyDay = () => {
    const doneTasks = tasks.filter(t => t.done || t.subtasks.some(s => s.done));
    const items = tasks.length === 0 ? ['(no entries)'] : tasks.map(t => {
      const status = t.done ? '[x]' : (t.subtasks.length > 0 && t.subtasks.every(s => s.done) ? '[x]' : '[ ]');
      const subs = t.subtasks.map(s => `    ${s.done ? '[x]' : '[ ]'} ${s.text}`);
      const prioTag = t.priority && t.priority !== 'none' ? ` (${PRIO[t.priority].label.toLowerCase()})` : '';
      return `- ${status} ${t.title}${prioTag}${subs.length ? '\n' + subs.join('\n') : ''}`;
    });
    const dayLabel = DAY_NAMES[dayIdx] + ' ' + date.toLocaleDateString(undefined, { month:'short', day:'numeric' });
    const text = `${dayLabel}\n${items.join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      showToast(`Copied ${DAY_NAMES[dayIdx]}'s entries`);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const dateNum = date.getDate();
  const monthLetter = date.toLocaleDateString(undefined, { month:'short' }).toLowerCase();

  return (
    <div
      className={'nmd-day' + (isToday ? ' today' : '') + (isWeekend ? ' weekend' : '') + (dragOver ? ' drop-target' : '')}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDropTask(id);
      }}
    >
      <div className="nmd-day-header">
        <div className="nmd-day-labels">
          <span className="nmd-day-name">{DAY_NAMES[dayIdx]}</span>
          <span className="nmd-day-num">
            {dateNum}
            <span style={{fontSize:11, color:'var(--fg4)', fontWeight:400, marginLeft:4, fontFamily:'var(--font-mono)'}}>{monthLetter}</span>
          </span>
        </div>
        <div className="nmd-day-actions">
          <button
            className={'nmd-day-btn' + (copied ? ' copied' : '')}
            title="Copy entries (for timesheet)"
            onClick={copyDay}
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12l5 5L20 6"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="8" y="8" width="12" height="12" rx="2"/>
                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>
              </svg>
            )}
          </button>
          <button className="nmd-day-btn" title="New task" onClick={() => setAdding(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </div>
      <div className="nmd-day-body">
        {tasks.length === 0 && !adding && (
          <div className="nmd-day-empty">Nothing planned.</div>
        )}
        {tasks.map(t => (
          <Task
            key={t.id}
            task={t}
            onUpdate={(patch) => onUpdateTask(t.id, patch)}
            onDelete={() => onDeleteTask(t.id)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dragging={draggingId === t.id}
          />
        ))}
        {adding ? (
          <input
            autoFocus
            className="nmd-add-task-input"
            placeholder="What needs doing?"
            value={addText}
            onChange={e => setAddText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitAdd();
              if (e.key === 'Escape') { setAdding(false); setAddText(''); }
            }}
            onBlur={submitAdd}
          />
        ) : (
          <button className="nmd-add-task" onClick={() => setAdding(true)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

function WeeklyTracker({ tasksByDate, setTasksByDate, showToast }) {
  const [weekStart, setWeekStart] = React.useState(() => {
    const stored = localStorage.getItem('nmd_week');
    return stored ? startOfWeek(new Date(stored)) : startOfWeek(new Date());
  });
  const [draggingId, setDraggingId] = React.useState(null);

  React.useEffect(() => { localStorage.setItem('nmd_week', weekStart.toISOString()); }, [weekStart]);

  const today = new Date(); today.setHours(0,0,0,0);
  const days = Array.from({length: 7}, (_, i) => addDays(weekStart, i));

  const getTasks = (d) => tasksByDate[fmtDate(d)] || [];

  const updateTasks = (dateKey, fn) => {
    setTasksByDate(prev => {
      const existing = prev[dateKey] || [];
      const next = fn(existing);
      if (next.length === 0) {
        const { [dateKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dateKey]: next };
    });
  };

  const addTask = (dateKey, title) => {
    const t = { id: 't' + Date.now(), title, done: false, priority: 'none', subtasks: [], created: Date.now() };
    updateTasks(dateKey, tasks => [...tasks, t]);
  };

  const updateTask = (dateKey, id, patch) => {
    updateTasks(dateKey, tasks => tasks.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const deleteTask = (dateKey, id) => {
    updateTasks(dateKey, tasks => tasks.filter(t => t.id !== id));
  };

  const moveTask = (taskId, toDateKey) => {
    let task = null, fromKey = null;
    for (const [k, list] of Object.entries(tasksByDate)) {
      const f = list.find(t => t.id === taskId);
      if (f) { task = f; fromKey = k; break; }
    }
    if (!task || fromKey === toDateKey) return;
    setTasksByDate(prev => {
      const next = { ...prev };
      const fromList = (next[fromKey] || []).filter(t => t.id !== taskId);
      if (fromList.length === 0) delete next[fromKey]; else next[fromKey] = fromList;
      next[toDateKey] = [...(next[toDateKey] || []), task];
      return next;
    });
  };

  // Summary stats
  const weekTasks = days.flatMap(d => getTasks(d));
  const doneCount = weekTasks.filter(t => t.done).length;
  const totalCount = weekTasks.length;
  const byPrio = { high: 0, med: 0, low: 0 };
  weekTasks.forEach(t => { if (byPrio[t.priority] !== undefined && !t.done) byPrio[t.priority]++; });

  const isCurrentWeek = fmtDate(weekStart) === fmtDate(startOfWeek(today));

  return (
    <div className="nmd-tracker" data-screen-label="Weekly tracker">
      <header className="nmd-tracker-header">
        <div className="nmd-tracker-title">
          <h1>Week</h1>
          <span className="nmd-tracker-range">{fmtRange(weekStart)}</span>
        </div>
        <div className="nmd-tracker-nav">
          <button className="nmd-iconbtn" title="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m15 6-6 6 6 6"/></svg>
          </button>
          {!isCurrentWeek && (
            <button className="nmd-btn" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</button>
          )}
          <button className="nmd-iconbtn" title="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m9 6 6 6-6 6"/></svg>
          </button>
        </div>
        <div className="nmd-tracker-spacer"/>
        <div className="nmd-week-stats">
          <span className="nmd-pill"><b>{doneCount}</b>/{totalCount} done</span>
          {byPrio.high > 0 && <span className="nmd-pill" title="Open high-priority"><span className="nmd-task-prio-dot nmd-prio-high" style={{marginRight:5}}/><b>{byPrio.high}</b> high</span>}
          {byPrio.med > 0 && <span className="nmd-pill"><span className="nmd-task-prio-dot nmd-prio-med" style={{marginRight:5}}/><b>{byPrio.med}</b> med</span>}
        </div>
      </header>

      <div className="nmd-week-grid">
        {days.map((d, i) => {
          const key = fmtDate(d);
          return (
            <DayColumn
              key={key}
              dayIdx={i}
              date={d}
              tasks={getTasks(d)}
              isToday={fmtDate(d) === fmtDate(today)}
              isWeekend={i >= 5}
              onAddTask={(title) => addTask(key, title)}
              onUpdateTask={(id, patch) => updateTask(key, id, patch)}
              onDeleteTask={(id) => deleteTask(key, id)}
              onDropTask={(id) => moveTask(id, key)}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
              draggingId={draggingId}
              showToast={showToast}
            />
          );
        })}
      </div>
    </div>
  );
}

window.WeeklyTracker = WeeklyTracker;
