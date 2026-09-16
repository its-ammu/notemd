# NoteMD

![CI](https://github.com/its-ammu/notemd/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

A personal productivity app with three main features:

- **Home dashboard** — daily overview with tasks, meetings, and recent pages
- **Notebooks** — markdown-based note-taking with pages organized in notebooks
- **Weekly tracker** — task and meeting management with day/workweek/week views

The web app lives in [`app/`](app/) (React + Vite), with optional desktop
(Tauri, [`app/src-tauri/`](app/src-tauri/)) and iOS ([`mobile/`](mobile/))
shells. Data is synced through [Supabase](https://supabase.com) (Postgres +
Auth + Storage). Note content is encrypted in the browser with an app-wide
AES-256-GCM key before it is stored, so a database dump alone is not readable.

## Getting started

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) and create a new project.

### 2. Set up the database

Run the migrations in [`supabase/migrations/`](supabase/migrations/) against
your project, in order — either with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

or by pasting each file's contents into the Supabase SQL editor in numeric
filename order.

This creates the `notebooks`, `pages`, `tasks`, `meetings`, and `profiles`
tables, their row-level security policies, and the `page-images` storage
bucket used for image uploads.

### 3. Deploy the encryption key function

NoteMD encrypts note content with a single app-wide key served to signed-in
users by an edge function. See [`supabase/functions/enc-key`](supabase/functions/enc-key)
for details:

```bash
supabase secrets set NOTEMD_ENC_KEY=$(openssl rand -base64 32)
supabase functions deploy enc-key
```

Store a copy of the key somewhere safe. Data already encrypted with it cannot
be recovered if the secret is lost.

### 4. Configure the app

```bash
cd app
cp .env.example .env.local
```

Fill in `.env.local` with your Supabase project URL and anon key.

### 5. Run it

```bash
npm install
npm run dev      # start dev server
npm run build    # production build
npm run lint     # ESLint check
```

See [`app/README.md`](app/README.md) for more on the web app's structure,
[`mobile/README.md`](mobile/README.md) for the iOS app,
[`CLAUDE.md`](CLAUDE.md) for an architecture overview, and
[`docs/theme.md`](docs/theme.md) for the UI design language.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
