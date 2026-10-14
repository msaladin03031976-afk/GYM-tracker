import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../auth';
import Toast, { useToast } from '../components/Toast';

export default function Settings() {
  const nav = useNavigate();
  const { session } = useAuth();
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setError(error.message);
    else { setPw(''); showToast('Password updated'); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav('/login', { replace: true });
  }

  return (
    <div className="page">
      <h1>Settings</h1>
      <p className="sub">Signed in as {session?.user.email}</p>

      <Link to="/profile" className="card tap row between" style={{ display: 'flex', color: 'inherit' }}>
        <span style={{ fontWeight: 600 }}>Profile</span><span className="muted">Name, sex, height, weight ›</span>
      </Link>
      <Link to="/body-weight" className="card tap row between" style={{ display: 'flex', color: 'inherit' }}>
        <span style={{ fontWeight: 600 }}>Body weight</span><span className="muted">History & chart ›</span>
      </Link>

      <h2>Change password</h2>
      <form className="card" onSubmit={changePassword}>
        {error && <div className="error">{error}</div>}
        <label className="field"><span>New password</span>
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <button className="btn block" disabled={busy || !pw}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>

      <h2>About</h2>
      <div className="card small muted">
        Units: kilograms. Weight buttons step by 2.5 kg. Estimated 1RM uses the Epley formula.
        Your data is stored in your private cloud account and syncs across devices.
      </div>

      <button className="btn danger block" style={{ marginTop: 24 }} onClick={signOut}>Sign out</button>
      <Toast msg={toast} />
    </div>
  );
}
