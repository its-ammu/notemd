import React, { useState } from 'react';

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.7 19.7 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.7 19.7 0 0 1-3.17 4.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

/* Shown when the user lands from a password-recovery email link (they already
   have a recovery session). On success, onDone drops them into the app. */
export function ResetPasswordScreen({ onUpdatePassword, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const mismatch = confirm.length > 0 && confirm !== password;
  const match = confirm.length > 0 && confirm === password && password.length >= 6;

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (mismatch) return;
    setBusy(true);
    try {
      const { error } = await onUpdatePassword(password);
      if (error) { setErr(error.message); return; }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nmd-auth-shell">
      <span className="nmd-brand-mark nmd-brand-mark-lg" aria-hidden="true">
        <span>m</span>
      </span>
      <div className="nmd-auth-card">
        <div className="nmd-brand-name">NoteMD</div>
        <h1>Choose a new password</h1>
        <p className="nmd-auth-sub">You're almost back in — set a new password for your account.</p>
        <form onSubmit={submit} className="nmd-auth-form">
          <label>
            <span>New password</span>
            <div className="nmd-pw-field">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                required minLength={6} autoFocus
                value={password} onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button" className="nmd-pw-toggle"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                title={showPw ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPw} />
              </button>
            </div>
          </label>
          <label>
            <span>Confirm new password</span>
            <div className={'nmd-pw-field' + (mismatch ? ' invalid' : '') + (match ? ' valid' : '')}>
              <input
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required minLength={6}
                aria-invalid={mismatch || undefined}
                value={confirm} onChange={e => setConfirm(e.target.value)}
              />
              <button
                type="button" className="nmd-pw-toggle"
                onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                title={showConfirm ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
            {mismatch && <div className="nmd-pw-hint err">Passwords do not match.</div>}
            {match && <div className="nmd-pw-hint ok">Passwords match.</div>}
          </label>
          {err && <div className="nmd-auth-err">{err}</div>}
          <button type="submit" className="nmd-btn primary" disabled={busy || mismatch}>
            {busy ? '…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AuthScreen({ onSignIn, onSignUp, onResetPassword }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);

  const confirmMismatch = mode === 'signup' && confirm.length > 0 && confirm !== password;
  const confirmMatch = mode === 'signup' && confirm.length > 0 && confirm === password && password.length >= 6;

  const switchMode = (next) => {
    setMode(next);
    setErr(null); setInfo(null); setConfirm('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (confirmMismatch) return;
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const { error } = await onResetPassword(email.trim());
        if (error) { setErr(error.message); return; }
        setInfo('If an account exists for that email, a reset link is on its way.');
        return;
      }
      const { error, data } = mode === 'signin'
        ? await onSignIn(email.trim(), password)
        : await onSignUp(email.trim(), password, displayName.trim());
      if (error) { setErr(error.message); return; }
      if (mode === 'signup' && !data.session) {
        setInfo('Check your email to confirm your account, then sign in.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nmd-auth-shell">
      <span className="nmd-brand-mark nmd-brand-mark-lg" aria-hidden="true">
        <span>m</span>
      </span>
      <div className="nmd-auth-card">
        <div className="nmd-brand-name">NoteMD</div>
        <h1>
          {mode === 'signin' ? 'Welcome back'
            : mode === 'signup' ? 'Create your account'
            : 'Reset your password'}
        </h1>
        <p className="nmd-auth-sub">
          {mode === 'signin'
            ? 'Sign in to sync your notebooks and tracker across devices.'
            : mode === 'signup'
            ? 'One account, all your notes and your week.'
            : "Enter your email and we'll send you a reset link."}
        </p>
        <form onSubmit={submit} className="nmd-auth-form">
          {mode === 'signup' && (
            <label>
              <span>Your name</span>
              <input
                type="text" autoComplete="name" required
                value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="What should we call you?"
              />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </label>
          {mode !== 'forgot' && (
            <label>
              <span>Password</span>
              <div className="nmd-pw-field">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required minLength={6}
                  value={password} onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button" className="nmd-pw-toggle"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  title={showPw ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </label>
          )}
          {mode === 'signin' && (
            <div className="nmd-auth-forgot">
              <button type="button" onClick={() => switchMode('forgot')}>Forgot password?</button>
            </div>
          )}
          {mode === 'signup' && (
            <label>
              <span>Confirm password</span>
              <div className={'nmd-pw-field' + (confirmMismatch ? ' invalid' : '') + (confirmMatch ? ' valid' : '')}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required minLength={6}
                  aria-invalid={confirmMismatch || undefined}
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                />
                <button
                  type="button" className="nmd-pw-toggle"
                  onClick={() => setShowConfirm(v => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  title={showConfirm ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {confirmMismatch && <div className="nmd-pw-hint err">Passwords do not match.</div>}
              {confirmMatch && <div className="nmd-pw-hint ok">Passwords match.</div>}
            </label>
          )}
          {err && <div className="nmd-auth-err">{err}</div>}
          {info && <div className="nmd-auth-info">{info}</div>}
          <button type="submit" className="nmd-btn primary" disabled={busy || confirmMismatch}>
            {busy ? '…'
              : mode === 'signin' ? 'Sign in'
              : mode === 'signup' ? 'Create account'
              : 'Send reset link'}
          </button>
        </form>
        <div className="nmd-auth-toggle">
          {mode === 'signin' ? (
            <>New here? <button type="button" onClick={() => switchMode('signup')}>Create an account</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => switchMode('signin')}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
