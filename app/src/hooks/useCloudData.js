import { useEffect, useRef, useState } from 'react';
import { fetchAllData, pushChanges } from '../lib/sync';
import { clearKey } from '../lib/encKey';

// One-time, per-device flag: when set, the backlog of rows written before
// encryption was enabled has already been re-uploaded as ciphertext.
const MIGRATION_FLAG = 'notemd_enc_migrated_v1';
const EMPTY = { notebooks: [], tasksByDate: {}, meetingsByDate: {} };

export function useCloudData(userId) {
  const [notebooks, setNotebooks] = useState([]);
  const [tasksByDate, setTasksByDate] = useState({});
  const [meetingsByDate, setMeetingsByDate] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Last state we've pushed (or hydrated from) — used as the diff baseline.
  const baseline = useRef({ notebooks: [], tasksByDate: {}, meetingsByDate: {} });
  const flushTimer = useRef(null);
  const pushing = useRef(false);

  // Hydrate whenever the signed-in user changes
  useEffect(() => {
    if (!userId) {
      setLoaded(false);
      setNotebooks([]);
      setTasksByDate({});
      setMeetingsByDate({});
      baseline.current = { notebooks: [], tasksByDate: {}, meetingsByDate: {} };
      clearKey();
      return;
    }
    let cancelled = false;
    setLoaded(false);
    setError(null);
    fetchAllData()
      .then(async data => {
        if (cancelled) return;
        setNotebooks(data.notebooks);
        setTasksByDate(data.tasksByDate);
        setMeetingsByDate(data.meetingsByDate);
        baseline.current = data;
        setLoaded(true);
        // One-time migration: re-upload everything so rows stored as plaintext
        // before encryption was enabled get rewritten as ciphertext. State is
        // always plaintext in memory, so diffing against an empty baseline
        // upserts every row encrypted. Idempotent; guarded to run once per device.
        if (!localStorage.getItem(MIGRATION_FLAG)) {
          try {
            await pushChanges(userId, EMPTY, data);
            localStorage.setItem(MIGRATION_FLAG, '1');
          } catch (e) {
            console.warn('[NoteMD] Encryption migration deferred to next load', e);
          }
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[NoteMD] Failed to load cloud data', err);
        setError(err.message || 'Failed to load data');
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Debounced push whenever state changes after initial hydration
  useEffect(() => {
    if (!userId || !loaded) return;
    // Skip the run triggered by hydration itself: setNotebooks(data.notebooks)
    // reuses the same references stored in baseline, so an unchanged-by-reference
    // state means nothing was edited — don't flash "Saving…".
    const changed =
      notebooks !== baseline.current.notebooks ||
      tasksByDate !== baseline.current.tasksByDate ||
      meetingsByDate !== baseline.current.meetingsByDate;
    if (!changed) return;

    setSaving(true);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(async () => {
      if (pushing.current) return;
      pushing.current = true;
      try {
        const next = { notebooks, tasksByDate, meetingsByDate };
        await pushChanges(userId, baseline.current, next);
        baseline.current = next;
        setError(null);
      } catch (err) {
        console.error('[NoteMD] Sync failed', err);
        setError(err.message || 'Sync failed');
      } finally {
        pushing.current = false;
        setSaving(false);
      }
    }, 600);
    return () => { if (flushTimer.current) clearTimeout(flushTimer.current); };
  }, [userId, loaded, notebooks, tasksByDate, meetingsByDate]);

  return {
    notebooks, setNotebooks,
    tasksByDate, setTasksByDate,
    meetingsByDate, setMeetingsByDate,
    loaded, error, saving,
  };
}
