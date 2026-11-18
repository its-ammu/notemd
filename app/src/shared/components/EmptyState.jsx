import React from 'react';
import {
  DoodleNotebook, DoodlePage, DoodleCheck, DoodleClock,
  DoodleMagnifier, DoodleSun,
} from './Doodles';

const STATES = {
  notebooks: {
    icon: <DoodleNotebook />,
    title: 'No notebooks yet',
    desc: 'Every great mess starts with an empty notebook.',
    action: 'Create your first notebook',
    tip: 'Click the + button above to get started',
  },
  pages: {
    icon: <DoodlePage />,
    title: 'This notebook is feeling light',
    desc: 'Pages are where the scribbling happens. Markdown welcome.',
    action: 'Create your first page',
    tip: 'Click "New page" below to start writing',
  },
  tasks: {
    icon: <DoodleCheck />,
    title: 'Nothing to do here',
    desc: 'Suspiciously peaceful. Add a task before it gets weird.',
    action: 'Add your first task',
    tip: 'Click the + button to add a task',
  },
  meetings: {
    icon: <DoodleClock />,
    title: 'No meetings scheduled',
    desc: 'Enjoy the silence while it lasts.',
    action: 'Schedule a meeting',
    tip: 'Click "Meeting" to add one',
  },
  dayTasks: {
    icon: <DoodleCheck size={40} />,
    title: 'Nothing on the list',
    desc: 'Add a task below, or enjoy the quiet.',
    action: null,
    tip: null,
  },
  search: {
    icon: <DoodleMagnifier />,
    title: 'Nothing turned up',
    desc: 'Even the magnifying glass looks confused. Try other words?',
    action: null,
    tip: 'Search looks through titles and content',
  },
  recentPages: {
    icon: <DoodlePage />,
    title: 'No recent pages',
    desc: 'Your latest scribbles will land here.',
    action: 'Go to Notebooks',
    tip: 'Create a page to see it here',
  },
  todayEmpty: {
    icon: <DoodleSun />,
    title: 'Today is wide open',
    desc: 'A blank day is a lucky day. Plan it — or wing it.',
    action: 'Open tracker',
    tip: 'Use the Weekly Tracker to plan your days',
  },
};

/* One empty-state look for the whole app: doodle, title, one wry line, and
   either an action button or (when there's nothing to click) a quiet tip.
   `compact` is for empty states inside a pane rather than a whole page. */
export default function EmptyState({ type, onAction, compact = false }) {
  const state = STATES[type];
  if (!state) return null;
  const showAction = state.action && onAction;

  return (
    <div className={'nmd-empty-state' + (compact ? ' compact' : '')}>
      <div className="nmd-empty-icon">{state.icon}</div>
      <h3 className="nmd-empty-title">{state.title}</h3>
      <p className="nmd-empty-desc">{state.desc}</p>
      {showAction && (
        <button className="nmd-empty-action" onClick={onAction}>
          {state.action}
        </button>
      )}
      {!showAction && state.tip && <span className="nmd-empty-tip">{state.tip}</span>}
    </div>
  );
}
