# NoteMD — Single-Key Encryption (Setup)

> **Status:** Implemented. Supersedes the per-user envelope design in
> [`encryption-plan.md`](./encryption-plan.md). One app-wide key encrypts every
> user's content fields so a database leak yields only ciphertext.

## How it works

```
NOTEMD_ENC_KEY (random 32 bytes, base64)
   stored as a Supabase secret — NOT in the DB, NOT in the JS bundle
        │
        ▼  served only to signed-in users
  enc-key edge function  ──►  browser caches CryptoKey in memory
        │
        ▼  AES-256-GCM, fresh IV per value
  lib/crypto.js  encrypts/decrypts fields inside lib/sync.js
```

- **Encrypted at rest:** page `title`/`body`/`tags`, notebook `name`, task
  `title`/`subtasks`, meeting `title`/`notes`.
- **Plaintext (app needs them):** `id`, `user_id`, `position`, `notebook_id`,
  `day`, timestamps, `done`, `priority`, sharing flags. This leaks *metadata*
  (that a task exists on a date, how many pages exist, edit times) — accepted.
- **Blob format:** `v1:<base64 iv>:<base64 ciphertext>`. Values without the
  `v1:` prefix are read as plaintext, so pre-encryption rows and public pages
  just work — no per-row flag.
- **Public shared pages are stored plaintext** (they're deliberately public, and
  anonymous visitors have no key). Toggling sharing rewrites that page's content
  to plaintext / back to ciphertext immediately, in the same call as the toggle.
  Tags stay encrypted when "hide tags" is on, so they can't leak to anonymous
  readers; the public viewer also filters out any `v1:` ciphertext defensively.

## One-time setup

### 1. Generate the key — and keep your own copy

```bash
openssl rand -base64 32
```

⚠️ **Save this string in your password manager before anything else.** The
Supabase secret is a *copy*, not the system of record — `secrets list` won't
always read the value back. Lose every copy of the key and the data is
unrecoverable.

### 2. Store it as a Supabase secret

```bash
supabase secrets set NOTEMD_ENC_KEY='<paste the base64 string>'
```

### 3. Deploy the edge function

```bash
supabase functions deploy enc-key
```

`verify_jwt` defaults to **true**, which is what we want. The function also calls
`auth.getUser()` so the public anon key can't fetch the key — only a real signed-in
session can. `SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically.

> No Supabase CLI? `npm i -g supabase`, then `supabase login` and
> `supabase link --project-ref <your-ref>` once before the commands above.

### 4. Confirm the `subtasks` column is `jsonb`

The code encrypts a task's subtasks into a single JSON-string blob. That requires
`tasks.subtasks` to be `jsonb` (it is, if it stores objects). In the SQL editor:

```sql
select data_type from information_schema.columns
where table_name = 'tasks' and column_name = 'subtasks';
```

Expect `jsonb`. If it's `text[]`, tell me and I'll adjust the encoding.

### 5. First load migrates the backlog

On the next app load after deploy, the client re-uploads every existing row as
ciphertext (guarded by a `localStorage` flag so it runs once per device). Rows you
never touch afterward are encrypted by this pass; public pages stay plaintext.

## Moving off Supabase later

Fully portable — the key isn't trapped in Supabase:

- **Data:** `pg_dump` the database. Encrypted fields are ordinary `text` / `jsonb`
  columns; they restore into any Postgres.
- **Key:** it's the random string from step 1 (the copy in your password manager).
  Drop it into the new host's secret store.
- **Crypto:** standard AES-GCM via Web Crypto — any runtime (Node, Deno, Python,
  Go, browser) can decrypt the same blobs with the same key.

To point the app at a non-Supabase key source, change the one fetch in
`app/src/lib/encKey.js`.

## Caveats

- The key is app-wide: anyone who obtains it (you/operator, or via the live DB)
  can decrypt everything. RLS still scopes each user to their own rows; the key is
  not a second line of defense if RLS is misconfigured. (Accepted trade-off.)
- Pages shared before sharing rewrote content in-place may still hold ciphertext
  while public; `fetchAllData` detects and repairs them on the owner's next load.
- Rotating the key (vs. moving it) requires decrypting every row with the old key
  and re-encrypting with the new one. The `v1:` prefix leaves room for a future
  `v2:` to tell old blobs from new during such a pass.
