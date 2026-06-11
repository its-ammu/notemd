import { useEffect, useRef, useState } from 'react';
import { fetchAllData, pushChanges } from '../lib/sync';
import { clearKey } from '../lib/encKey';

const EMPTY = { tasksByDate: {}, meetingsByDate: {} };

export function useCloudData(userId) {
  const [tasksByDate, setTasksByDate] = useState({});
  const [meetingsByDate, setMeetingsByDate] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const baseline = useRef(EMPTY);
  const flushTimer = useRef(null);
  const pushing = useRef(false);

  useEffect(() => {
    if (!userId) {
      setLoaded(false);
      setTasksByDate({});
      setMeetingsByDate({});
      baseline.current = EMPTY;
      clearKey();
      return;
    }
    let cancelled = false;
    setLoaded(false);
    setError(null);
    fetchAllData()
      .then(data => {
        if (cancelled) return;
        setTasksByDate(data.tasksByDate);
        setMeetingsByDate(data.meetingsByDate);
        baseline.current = { tasksByDate: data.tasksByDate, meetingsByDate: data.meetingsByDate };
        setLoaded(true);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[NoteMD] Failed to load cloud data', err);
        setError(err.message || 'Failed to load data');
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId || !loaded) return;
    const changed =
      tasksByDate !== baseline.current.tasksByDate ||
      meetingsByDate !== baseline.current.meetingsByDate;
    if (!changed) return;

    setSaving(true);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(async () => {
      if (pushing.current) return;
      pushing.current = true;
      try {
        const next = { tasksByDate, meetingsByDate };
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
  }, [userId, loaded, tasksByDate, meetingsByDate]);

  return { tasksByDate, setTasksByDate, meetingsByDate, setMeetingsByDate, loaded, error, saving };
}
