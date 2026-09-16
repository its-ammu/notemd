# NoteMD (web app)

React + Vite web client for NoteMD. See the [repo root README](../README.md)
for full setup instructions (Supabase project, migrations, env vars) and
[`AGENTS.md`](../AGENTS.md) for an architecture overview.

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint     # ESLint check
npm run preview  # preview production build
```

## Desktop / mobile

- `src-tauri/` — Tauri desktop shell around this same web app.
- `../mobile/` — native SwiftUI iOS app (separate from this web client).
