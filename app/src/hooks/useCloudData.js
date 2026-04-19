import { useEffect, useRef, useState } from 'react';
import { fetchAllData, pushChanges } from '../lib/sync';

export function useCloudData(userId) {
  const [notebooks, setNotebooks] = useState([]);
  const [tasksByDate, setTasksByDate] = useState({});
  const [meetingsByDate, setMeetingsByDate] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

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
      return;
    }
    let cancelled = false;
    setLoaded(false);
    setError(null);
    fetchAllData()
      .then(data => {
        if (cancelled) return;
        setNotebooks(data.notebooks);
        setTasksByDate(data.tasksByDate);
        setMeetingsByDate(data.meetingsByDate);
        baseline.current = data;
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

  // Debounced push whenever state changes after initial hydration
  useEffect(() => {
    if (!userId || !loaded) return;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(async () => {
      if (pushing.current) return;
      pushing.current = true;
      try {
        const next = { notebooks, tasksByDate, meetingsByDate };
        await pushChanges(userId, baseline.current, next);
        baseline.current = next;
      } catch (err) {
        console.error('[NoteMD] Sync failed', err);
        setError(err.message || 'Sync failed');
      } finally {
        pushing.current = false;
      }
    }, 600);
    return () => { if (flushTimer.current) clearTimeout(flushTimer.current); };
  }, [userId, loaded, notebooks, tasksByDate, meetingsByDate]);

  return {
    notebooks, setNotebooks,
    tasksByDate, setTasksByDate,
    meetingsByDate, setMeetingsByDate,
    loaded, error,
  };
}
