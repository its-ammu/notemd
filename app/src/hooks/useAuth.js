import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // True while the user arrived via a password-recovery email link and hasn't
  // set a new password yet. Initialized from the URL hash as a fallback in
  // case the PASSWORD_RECOVERY event fires before we subscribe.
  const [passwordRecovery, setPasswordRecovery] = useState(() =>
    window.location.hash.includes('type=recovery') && window.location.hash.includes('access_token'));

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });
  const signUp = (email, password, displayName) =>
    supabase.auth.signUp({
      email, password,
      options: displayName ? { data: { display_name: displayName } } : undefined,
    });
  const signOut = () => supabase.auth.signOut();
  // The email link must open the deployed web app — the desktop app's own
  // origin (tauri://) is not reachable from a browser.
  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin,
    });
  const updatePassword = (password) => supabase.auth.updateUser({ password });
  const clearPasswordRecovery = () => {
    setPasswordRecovery(false);
    // Drop the recovery tokens from the address bar.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  };

  return {
    session, user: session?.user || null, loading, signIn, signUp, signOut,
    resetPassword, updatePassword, passwordRecovery, clearPasswordRecovery,
  };
}
