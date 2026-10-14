import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../auth';

/** Shown after the user opens the reset link from their email. */
export default function ResetPassword() {
  const nav = useNavigate();
  const { session, setRecovering } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError('Password must be at least 8 characters.');
    if (pw !== pw2) return setError('Passwords do not match.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    setRecovering(false);
    nav('/', { replace: true });
  }

  if (!session) {
    return (
      <div className="page no-nav">
        <h1 style={{ marginTop: 48 }}>Link expired</h1>
        <p className="sub">This reset link is invalid or has expired. Request a new one.</p>
        <button className="btn primary block" onClick={() => nav('/forgot-password')}>Request new link</button>
      </div>
    );
  }

  return (
    <div className="page no-nav">
      <h1 style={{ marginTop: 48 }}>Set a new password</h1>
      <form onSubmit={submit}>
        {error && <div className="error">{error}</div>}
        <label className="field"><span>New password</span><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label className="field"><span>Repeat new password</span><input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        <button className="btn primary block" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </div>
  );
}
