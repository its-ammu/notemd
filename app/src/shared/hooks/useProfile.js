import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_PREFS = {
  defaultView: 'home',
  meetingsDisplay: 'inline', // 'inline' (in day columns) | 'drawer' (bottom panel)
  copyMeetingDetails: 'full', // 'full' (time + duration + notes) | 'title' (name only)
  copyCase: 'original', // 'original' | 'lower' | 'upper' | 'title'
};

export function useProfile(userId, userEmail) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      if (data) {
        setProfile({
          display_name: data.display_name || '',
          avatar_url: data.avatar_url || null,
          preferences: { ...DEFAULT_PREFS, ...(data.preferences || {}) },
        });
      } else {
        // Trigger didn't run (e.g. existing user pre-migration) — create row now.
        const fallbackName = userEmail ? userEmail.split('@')[0] : '';
        const { data: inserted, error: insertErr } = await supabase
          .from('profiles')
          .insert({ user_id: userId, display_name: fallbackName })
          .select()
          .single();
        if (cancelled) return;
        if (insertErr) {
          setError(insertErr.message);
        } else {
          setProfile({
            display_name: inserted.display_name || '',
            avatar_url: inserted.avatar_url || null,
            preferences: { ...DEFAULT_PREFS, ...(inserted.preferences || {}) },
          });
        }
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId, userEmail]);

  // Patch the profile locally and debounce an upsert to the server.
  const updateProfile = (patch) => {
    setProfile(prev => {
      const next = {
        ...(prev || { display_name: '', avatar_url: null, preferences: { ...DEFAULT_PREFS } }),
        ...patch,
        preferences: {
          ...(prev?.preferences || DEFAULT_PREFS),
          ...(patch.preferences || {}),
        },
      };

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (!userId) return;
        const { error } = await supabase
          .from('profiles')
          .upsert({
            user_id: userId,
            display_name: next.display_name,
            avatar_url: next.avatar_url,
            preferences: next.preferences,
          });
        if (error) setError(error.message);
      }, 400);

      return next;
    });
  };

  return { profile, loading, error, updateProfile };
}
