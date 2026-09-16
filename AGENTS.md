# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NoteMD is a personal productivity app with three main features:
- **Home dashboard** - daily overview with tasks, meetings, and recent pages
- **Notebooks** - markdown-based note-taking with pages organized in notebooks
- **Weekly tracker** - task and meeting management with day/workweek/week views

## Commands

All commands run from the `app/` directory:

```bash
npm run dev      # Start dev server (Vite)
npm run build    # Production build
npm run lint     # ESLint check
npm run preview  # Preview production build
```

## Setup

Copy `app/.env.example` to `app/.env.local` and set:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

## Architecture

### Data Flow

```
App.jsx
  ├── useAuth()        → Supabase auth (sign in/up/out)
  ├── useCloudData()   → notebooks, tasksByDate, meetingsByDate
  ├── useProfile()     → user preferences (display name, default view)
  └── Three main panes: HomePane, NotebooksPane, WeeklyTracker
```

### Source layout (`app/src/`)

```
App.jsx, main.jsx
features/
  auth/          AuthScreen
  home/          HomePane
  notebooks/     NotebooksPane, NotebookSidebar, TagInput, ShareDialog, PublicPage
    editor/      MarkdownEditor, MarkdownView, markdown helpers
  tracker/       WeeklyTracker, DayColumn, Task*, Meeting*, DatePicker, meetings.js
  radio/         RadioPane, useRadio, youtube.js
  pomodoro/      PomodoroTimer
shared/
  components/    NavRail, SettingsModal, HowToModal, Doodles, EmptyState, …
  hooks/         useAuth, useCloudData, useProfile, useStoredState, useToast
  lib/           sync, supabase, uploadImage, openExternal, …
  utils/         constants, time, tags, seed
  styles/        tokens, shell, auth, notebooks, tracker, home, radio, responsive
```

### Sync System (`shared/lib/sync.js`)

- `fetchAllData()` - hydrates client state from 4 Supabase tables: notebooks, pages, tasks, meetings
- `pushChanges()` - diffs prev/next state, upserts changed rows, deletes removed rows
- `useCloudData` hook debounces writes (600ms) and maintains a baseline for diffing

### Database Tables

| Table | Key Fields |
|-------|------------|
| notebooks | id, user_id, name, color, paper, position |
| pages | id, user_id, notebook_id, title, body, tags[], position |
| tasks | id, user_id, day (YYYY-MM-DD), title, done, priority, subtasks[], linked_page_id |
| meetings | id, user_id, day, title, time, duration, repeat, notes, linked_page_id |

### State Shape

```javascript
notebooks: [{ id, name, color, paper, pages: [{ id, title, body, tags, created, updated }] }]
tasksByDate: { "2024-01-15": [{ id, title, done, priority, subtasks, linkedPageId }] }
meetingsByDate: { "2024-01-15": [{ id, title, time, duration, repeat, notes, linkedPageId }] }
```

### Key Components

- **NotebooksPane** - sidebar tree + markdown editor (CodeMirror) + preview (react-markdown)
- **WeeklyTracker** - grid of DayColumn components, TaskDialog/MeetingDialog for editing
- **HomePane** - aggregates today's tasks/meetings + recent pages + weekly stats

### Styling

CSS lives in `app/src/shared/styles/` (import order in `main.jsx`: tokens → shell → feature sheets → responsive). Class prefix: `nmd-`.

**Before any UI work, read `docs/theme.md`** — the design language ("modern notebook"), token rules, doodle/icon conventions, modal and settings patterns, and voice guidelines live there.

### Recurring Meetings

`features/tracker/meetings.js` expands recurring meetings (daily/weekly/biweekly) for a date range. Source meeting stores `repeat`, `skipDates[]`, and optional `endDate`. Expanded instances get `_recurring: true` flag.
