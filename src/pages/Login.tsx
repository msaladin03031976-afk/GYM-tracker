import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
    const from = (loc.state as { from?: string } | null)?.from;
    nav(from && from !== '/login' ? from : '/', { replace: true });
  }

  return (
    <div className="page no-nav">
      <div style={{ marginTop: 48, marginBottom: 32 }}>
        <div className="brand">Gym<span>Tracker</span></div>
        <p className="sub">Log every set. See every gain.</p>
      </div>
      <form onSubmit={submit}>
        {error && <div className="error">{error}</div>}
        <label className="field"><span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field"><span>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="center" style={{ marginTop: 18 }}><Link to="/forgot-password">Forgot password?</Link></p>
      <p className="center muted">No account? <Link to="/register">Create one</Link></p>
    </div>
  );
}
