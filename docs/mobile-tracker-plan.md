# NoteMD Mobile — Weekly Tracker (Expo)

## Context

NoteMD is a web productivity app (React + Vite + Supabase). The user wants a **React Native mobile companion** with a deliberately simple, minimal UI, centered on **gesture-driven interactions** — notably a **pull-down-to-create-task** flow.

Decisions confirmed with the user:
- **Scope (v1): Weekly Tracker only** — tasks + meetings. No notebooks/pages, no Pomodoro, no Home dashboard.
- **Tooling: Expo (managed) in a new `mobile/` folder** inside this repo. Goal: runs in **Expo Go**, no native build step.
- **Backend: reuse the same Supabase project** — same email/password auth and the same **AES-256-GCM field encryption** (via the `enc-key` edge function), so data written on mobile reads correctly on web and vice-versa.

The web tracker lives in `app/src/components/WeeklyTracker.jsx` (+ `DayColumn`, `TaskDialog`, `MeetingDialog`), with sync in `app/src/lib/sync.js`, crypto in `app/src/lib/crypto.js`/`encKey.js`, and pure helpers in `app/src/utils/{time,meetings,constants}.js`.

## Key technical decision: encryption without `crypto.subtle`

The web crypto layer (`app/src/lib/crypto.js`) uses Web Crypto `crypto.subtle` + `btoa`/`atob`, neither available in React Native / Expo Go. To stay byte-compatible with the web blob format `v1:base64(iv):base64(ciphertext)` (AES-256-GCM, 12-byte IV), the mobile crypto module will be reimplemented with **pure-JS, Expo-Go-safe** libraries:
- `@noble/ciphers` → `gcm` (audited pure-JS AES-256-GCM).
- `base64-js` → `fromByteArray`/`toByteArray` (replaces `btoa`/`atob`).
- `expo-crypto` → `getRandomBytes(12)` for the IV and `randomUUID()` (replaces `crypto.randomUUID()`).

This produces identical blobs to the web app, so cross-platform decryption works. The `blobByPlain` cache (avoids re-encrypting unchanged fields → avoids sync churn) is preserved verbatim.

## Approach

A single-repo Expo app under `mobile/` that **reuses the web app's logic where it is pure JS** (time, meetings, constants, sync/diff structure, hooks) and replaces only the platform-bound pieces (crypto primitives, storage, DOM UI).

### Project setup (`mobile/`)
- Scaffold Expo (managed, SDK current). Entry gates on auth like web `App.jsx`: signed-out → `AuthScreen`, loading → spinner, signed-in → `TrackerScreen`. No nav library needed (one screen + auth) — keep it minimal.
- Dependencies (all Expo-Go compatible): `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `react-native-gesture-handler`, `react-native-reanimated`, `@gorhom/bottom-sheet`, `@noble/ciphers`, `base64-js`, `expo-crypto`.
- `babel.config.js`: add `react-native-reanimated/plugin`. Wrap root in `GestureHandlerRootView`. Import `react-native-url-polyfill/auto` at entry top.

### Library layer — ported with minimal changes
- **`src/lib/supabase.js`** — `createClient` with `auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }`. URL/anon key from `app.config.js` `extra` (read via `expo-constants`).
- **`src/lib/crypto.js`** — same public API (`encryptText/decryptText/encryptTags/decryptTags/encryptJson/decryptJson`, `importKey`, `isEncrypted`) reimplemented on `@noble/ciphers` + `base64-js` + `expo-crypto` per the section above.
- **`src/lib/encKey.js`** — ported **verbatim** (`supabase.functions.invoke('enc-key')` works in RN).
- **`src/lib/sync.js`** — port `fetchAllData`/`pushChanges`/diff helpers, **trimmed to the `tasks` + `meetings` tables only** (drop notebooks/pages, pomo, and public-sharing). `linkedPageId` on tasks/meetings is **read and written back unchanged** (preserve data even though there's no linking UI). Skip the one-time encryption migration (web already owns that).

### Pure helpers — ported verbatim
`src/utils/time.js`, `src/utils/meetings.js`, `src/utils/constants.js` (`PRIO`, `NB_COLORS`, `DAY_NAMES`) copied as-is. Replace `crypto.randomUUID()` call sites with `expo-crypto`'s `randomUUID()`.

### Hooks — ported
- **`src/hooks/useAuth.js`** — verbatim (`getSession`, `onAuthStateChange`, `signIn/signUp/signOut`).
- **`src/hooks/useCloudData.js`** — ported, **trimmed to `tasksByDate` + `meetingsByDate`** (no notebooks). Same 600ms debounced diff-push and baseline-ref logic. Migration-flag block removed.

### Screens & components (minimal UI)
- **`screens/AuthScreen.jsx`** — email/password, toggle sign-in / sign-up, error text. Plain `TextInput`s, one accent button.
- **`screens/TrackerScreen.jsx`** — **Day view is the mobile default** (a 7-day week grid doesn't fit a phone). Header: current day label + prev/next chevrons + "Today". A **`DayStrip`** week selector (Mon–Sun pills, today highlighted, dot if the day has items) for quick switching. Below: the day's meetings, then the `PullToCreate`-wrapped task list. A small week-stats pill row (`done/total`, high-priority count) reusing the web stat computation.
- **`components/PullToCreate.jsx`** — the headline gesture. A Reanimated + gesture-handler wrapper around the task list: **over-scrolling/pulling down past a threshold at the top reveals an inline "New task" input that auto-focuses** (iOS-Reminders / pull-to-compose style). Submitting calls `addTask(dateKey, title)` and keeps focus for rapid entry; releasing under the threshold springs back. Animate only `transform`/`opacity` (per the RN skill `animation-gpu-properties`).
- **`components/TaskRow.jsx`** — checkbox (toggle `done`), title, priority dot (`PRIO` colors), subtask progress count. `memo`'d. Wrapped in gesture-handler `Swipeable`: swipe-left → delete, swipe-right → +1 day (move to tomorrow). Tap → open `TaskSheet`.
- **`components/TaskSheet.jsx`** — `@gorhom/bottom-sheet` editor: title, priority segmented control, subtasks (add/toggle/remove), quick-move (+1, +7, date picker), delete. Mirrors web `TaskDialog` fields minus page-linking/Pomodoro.
- **`components/MeetingRow.jsx`** + **`components/MeetingSheet.jsx`** — meeting list item (time · title · duration); sheet to create/edit (title, time, duration, repeat: none/daily/weekly/biweekly, notes) and delete with the three recurring options (this occurrence / this + future / whole series) wired to `skipMeetingOccurrence` / `endMeetingFrom` / `deleteMeeting`, exactly as web `WeeklyTracker` does. Recurring expansion reuses ported `expandRecurringMeetings`.
- **`src/theme.js`** — central tokens (background, surface, text, accent from `NB_COLORS` blue, `PRIO` colors, spacing, radii) used via `StyleSheet.create` (per RN skill `ui-styling`). Light theme only for v1.

### Reused web logic (do not reinvent)
- Recurring expansion: `app/src/utils/meetings.js` `expandRecurringMeetings`.
- Task/meeting CRUD + move + recurring delete semantics: the handlers in `app/src/components/WeeklyTracker.jsx` (`addTask`, `updateTask`, `moveTask`, `saveMeeting`, `skipMeetingOccurrence`, `endMeetingFrom`, `deleteMeeting`) — port their bodies into `TrackerScreen`.
- Diff/push/encrypt pipeline: `app/src/lib/sync.js`.

## Files to create (all under `mobile/`)
```
mobile/app.config.js, package.json, babel.config.js, App.js, index.js
mobile/src/lib/{supabase,crypto,encKey,sync}.js
mobile/src/hooks/{useAuth,useCloudData}.js
mobile/src/utils/{time,meetings,constants}.js
mobile/src/theme.js
mobile/src/screens/{AuthScreen,TrackerScreen}.jsx
mobile/src/components/{DayStrip,PullToCreate,TaskRow,TaskSheet,MeetingRow,MeetingSheet}.jsx
```
No files in `app/` change.

## Verification
1. `cd mobile && npx expo install` then `npx expo start`; open in **Expo Go** (iOS/Android) or a simulator.
2. **Auth:** sign in with the existing account (`amuthavarsnirajkumar@gmail.com`). Confirm session persists across app reload (AsyncStorage).
3. **Cross-platform crypto:** a task created on web appears decrypted on mobile; a task created on mobile appears decrypted on web (proves byte-identical AES-GCM blobs). Confirm via the running web app (`cd app && npm run dev`).
4. **Pull-to-create:** at the top of a day, pull down → input reveals & focuses → type + submit → task appears and persists after reload.
5. **Task flows:** toggle done, swipe-delete, swipe→+1 day, edit priority/subtasks in the sheet, quick-move +7.
6. **Meetings:** create a weekly-recurring meeting; verify ghost instances render on later days in `DayStrip`/day view; test the three recurring-delete options.
7. **Sync:** edits debounce-push (~600ms); kill and relaunch the app → data reloads from Supabase.

## Out of scope (v1)
Notebooks/pages & markdown, Home dashboard, Pomodoro, public sharing, profile/display-name & default-view prefs, dark mode, drag-and-drop between day columns (replaced by swipe/quick-move), settings/export-import.
