# Contributing to NoteMD

Thanks for your interest in contributing! This is a personal project that
welcomes outside contributions.

## Setup

Follow the [README](README.md) to get a local Supabase project and the web
app running before making changes. iOS setup is in
[mobile/README.md](mobile/README.md).

## Making changes

1. Fork the repo and create a branch off `main`.
2. Keep changes focused — a PR should do one thing (a bug fix, a feature, a
   refactor), not several unrelated things at once.
3. Match the existing code style (see [CLAUDE.md](CLAUDE.md) for architecture
   and conventions). Run `npm run lint` in `app/` before opening a PR.
4. If your change touches the database schema, add a new file under
   `supabase/migrations/` rather than editing an existing one — migrations are
   append-only so they replay consistently for everyone.
5. Test your change against a real Supabase project and the actual UI, not
   just by reading the diff.

## Opening a pull request

- Describe **what** changed and **why**, not just a restatement of the diff.
- Link any related issue.
- Keep the PR small enough to review in one sitting where possible.

## Reporting bugs / requesting features

Please use the issue templates when opening an issue — they help make sure
reports have the info needed to act on them.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful.
