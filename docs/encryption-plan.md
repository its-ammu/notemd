# NoteMD — Optional Client-Side Encryption (Plan)

> **⚠️ Superseded.** We went with a simpler **single app-wide key** instead of
> per-user envelope encryption. See [`encryption-setup.md`](./encryption-setup.md)
> for the implemented design. This doc is kept for the rationale and as a reference
> if stricter per-user / end-to-end encryption is ever wanted.
>
> **Status:** Planned, not implemented. This is a design doc to pick up later.
> Today all user data (notebook names, page titles/bodies/tags, task titles/subtasks,
> meeting titles/notes) is stored as **plaintext** in Supabase.

## Goal

Let a user opt in to encrypting their content so that a **database leak** (stolen
dump, backup, or rogue read of the tables) yields only ciphertext. Encryption is
**optional** and toggled in **Settings** — off by default; existing behavior is
unchanged until a user turns it on.

## Decisions already made

| Question | Decision | Implication |
|---|---|---|
| Threat model | **Protect against DB leak only** | Operator *can* decrypt (via escrow key). Not strict end-to-end. |
| Key source | **Reuse login password** | No second passphrase. Password derives the unlock key. |
| Recovery | **Server-escrow** | Password reset still recovers data. You hold an escrow key. |
| Sharing | **Key in URL fragment** | DB stays ciphertext; share link carries the page key in `#k=...`. |
| Rollout | **Opt-in toggle in Settings** | Per-user; plaintext until enabled. |

## Why not the simpler options

- **Supabase disk-at-rest encryption** (already on) and **`pgcrypto`/Vault column
  encryption** both leave the key on the server side — they stop a disk thief but
  not a privileged read. They don't meet "data isn't sitting in plaintext."
- Naive "derive key directly from password" **loses all data on password reset**
  (a forgot-password flow never has the old password, so the old key is gone).
  The envelope pattern below fixes that.

## Core design: envelope encryption

Data is never encrypted with the password key directly. Instead:

```
random Master Key  ──encrypts──►  all content fields
        ▲
        │ stored wrapped (encrypted) by:
        ├── key derived from login password   ← normal unlock
        └── escrow key (server-held, in env/Vault, NOT in the DB)  ← reset path
```

- **Master key** never changes, so the data never has to be re-encrypted when the
  password changes.
- **Login** → derive key from password + per-user salt → unwrap master key.
- **Change password** (knows old password) → unwrap with old, re-wrap with new.
- **Forgot-password reset** (no old password) → a backend uses the escrow key to
  unwrap the master key and re-wrap it under the new password. **User gets data back.**
- **DB dump alone** = ciphertext + a master key wrapped under a server key that is
  *not in the database* → useless. (DB **+** escrow secret together = exposed; this
  is inherent to "DB-leak-only" protection.)

## Schema changes

- `profiles.encryption_enabled boolean default false`
- New `user_keys` (or columns on `profiles`):
  - `kdf_salt` — per-user random salt for the password KDF
  - `wrapped_key_pw` — master key wrapped by the password-derived key
  - `wrapped_key_escrow` — master key wrapped by the server escrow key
  - `key_version int`
- `is_encrypted boolean default false` on `pages`, `tasks`, `meetings`, `notebooks`
  — per-row marker so a partial migration is safe to resume and mixed state reads
  correctly.

## Components to build

### `lib/crypto.js`
- `deriveKey(password, salt)` — PBKDF2 via Web Crypto (no deps), or Argon2id (WASM) if preferred.
- `wrapKey` / `unwrapKey` — AES-GCM wrap of the master key.
- `encryptField(masterKey, text)` → `base64(iv).base64(ciphertext)` (fresh IV per call).
- `decryptField(masterKey, blob)` → text.

### `useEncryption` hook + in-memory/IndexedDB key cache
- On login *with password*: derive → unwrap → cache `CryptoKey` (memory + IndexedDB).
- On session restore *without password* (refresh) while encryption is on: use cached
  key, or show a lightweight **"Unlock your notes"** prompt for the password.
- Until unlocked, gate the notebooks UI behind the unlock screen.

### Settings UI (the toggle)
- New "Encryption" row in the Settings modal.
- **Off → On**: explainer + **password prompt** (required — when toggling from
  Settings the user has a session token but the password isn't in memory). On confirm:
  derive key → generate master key → wrap (password + escrow) → store → run migration →
  set `encryption_enabled = true`.
- **On → Off**: password prompt → decrypt all rows back to plaintext → clear key
  records → flag off.
- Show state: "Encrypted" / "Not encrypted" + a "you'll need your password to read
  your notes" note.

### `lib/sync.js` changes
- `fetchAllData`: if a row's `is_encrypted`, decrypt content fields after read.
- `flatten*`: if encryption on, encrypt content fields and set `is_encrypted = true`;
  leave structural fields plaintext.
- **Diff churn fix:** a fresh random IV per save makes every field look "changed,"
  re-uploading everything each keystroke. Cache ciphertext keyed by plaintext so
  unchanged fields keep a stable blob.

### Migration
- One-time client pass on enable: read plaintext rows → encrypt → write with
  `is_encrypted = true`, in batches, resumable via the per-row flag.
- Disable does the reverse.

### Password reset (escrow) — backend
- A Supabase **Edge Function** (Deno) holding the escrow key as an env secret
  (never in the DB). After a reset it unwraps the master key via `wrapped_key_escrow`
  and re-wraps it under the new password-derived key.
- This is the only piece that needs a server-held secret. If you don't want to run an
  edge function yet, the reset path degrades to "user must remember their password."

### Sharing under encryption
- Only changes when encryption is **on**.
- Each shared page gets a per-page random key. `get_public_page` returns ciphertext.
- Share link becomes `?p=<token>#k=<page-key>`. The `#fragment` is never sent to the
  server. `PublicPage` reads the key from `location.hash` and decrypts in-browser.
- When encryption is off, sharing works exactly as it does now.

## What is and isn't encrypted

- **Encrypted:** page `title`, `body`, `tags`; notebook `name`; task `title`,
  `subtasks`; meeting `title`, `notes`.
- **Plaintext (app needs them to function):** `id`, `user_id`, `position`,
  `notebook_id`, task `day`, timestamps. ⚠️ This leaks *metadata* — that a task
  exists on a date, how many pages exist, edit times. Accepted trade-off.
- **Search & tag filtering still work** — NoteMD loads everything and searches
  in-memory on the client, so it runs on decrypted plaintext.

## Suggested build order

1. **Stage A** — `lib/crypto.js`, key management + unlock, Settings toggle, and
   migration for **notebooks/pages only**. Verify end-to-end.
2. **Stage B** — extend encryption to tasks + meetings.
3. **Stage C** — rework public sharing to the URL-fragment key.
4. **Stage D** — escrow edge function for password-reset recovery.

## Caveats to surface in the UI

- Lose password **and** lose escrow access → data unrecoverable.
- You (operator) can technically decrypt via the escrow key — the accepted trade-off.
- DB dump alone is useless; DB **+** escrow secret together is not.
- Enabling/disabling runs a full re-encryption pass over the user's data.

## Open questions

- Deploy a Supabase Edge Function for escrow re-wrap, or defer reset-recovery?
- PBKDF2 (built-in, simpler) vs Argon2id (WASM, stronger against brute force)?
- Cache the derived key on-device for refreshes (smoother) vs always re-prompt
  (stricter)?
