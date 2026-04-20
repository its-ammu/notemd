import React from 'react';

const STATES = {
  notebooks: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 19.5z" />
        <path d="M4 7.5h16M4 12h16M4 16.5h16" />
      </svg>
    ),
    title: 'No notebooks yet',
    desc: 'Notebooks help you organize your notes by topic or project.',
    action: 'Create your first notebook',
    tip: 'Click the + button above to get started',
  },
  pages: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
        <path d="M9 13h6M9 17h3" />
      </svg>
    ),
    title: 'No pages in this notebook',
    desc: 'Pages are where you write. Use markdown for formatting.',
    action: 'Create your first page',
    tip: 'Click "New page" below to start writing',
  },
  tasks: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
    title: 'No tasks for this day',
    desc: 'Add tasks to track what you need to get done.',
    action: 'Add your first task',
    tip: 'Click the + button to add a task',
  },
  meetings: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'No meetings scheduled',
    desc: 'Track meetings with times and set them to repeat.',
    action: 'Schedule a meeting',
    tip: 'Click "Meeting" to add one',
  },
  search: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
    title: 'No results found',
    desc: 'Try different keywords or check your spelling.',
    action: null,
    tip: 'Search looks through titles and content',
  },
  recentPages: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      </svg>
    ),
    title: 'No recent pages',
    desc: 'Pages you edit will appear here for quick access.',
    action: 'Go to Notebooks',
    tip: 'Create a page to see it here',
  },
  todayEmpty: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    ),
    title: 'Nothing scheduled today',
    desc: 'Your day is clear! Add tasks or meetings to plan ahead.',
    action: 'Open tracker',
    tip: 'Use the Weekly Tracker to plan your days',
  },
};

export default function EmptyState({ type, onAction }) {
  const state = STATES[type];
  if (!state) return null;

  return (
    <div className="nmd-empty-state">
      <div className="nmd-empty-icon">{state.icon}</div>
      <h3 className="nmd-empty-title">{state.title}</h3>
      <p className="nmd-empty-desc">{state.desc}</p>
      {state.action && onAction && (
        <button className="nmd-empty-action" onClick={onAction}>
          {state.action}
        </button>
      )}
      <span className="nmd-empty-tip">{state.tip}</span>
    </div>
  );
}
