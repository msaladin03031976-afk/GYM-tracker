import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SITE_URL, supabase } from '../supabase';

export default function Register() {
  const nav = useNavigate();
  const [f, setF] = useState({ full_name: '', email: '', password: '', sex: '', height_cm: '', current_weight_kg: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    setError('');
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: SITE_URL,
        data: { full_name: f.full_name.trim(), sex: f.sex, height_cm: f.height_cm, current_weight_kg: f.current_weight_kg },
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) nav('/', { replace: true });
    else setDone(true); // email confirmation is on
  }

  if (done) {
    return (
      <div className="page no-nav">
        <h1 style={{ marginTop: 48 }}>Check your email</h1>
        <p className="sub">We sent a confirmation link to <b>{f.email}</b>. Open it, then sign in.</p>
        <Link className="btn primary block" to="/login">Go to sign in</Link>
      </div>
    );
  }

  return (
    <div className="page no-nav">
      <h1 style={{ marginTop: 24 }}>Create account</h1>
      <p className="sub">Your workouts are private to you and synced to the cloud.</p>
      <form onSubmit={submit}>
        {error && <div className="error">{error}</div>}
        <label className="field"><span>Full name</span><input required value={f.full_name} onChange={set('full_name')} autoComplete="name" /></label>
        <label className="field"><span>Email</span><input type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></label>
        <label className="field"><span>Password (min 8 characters)</span><input type="password" required value={f.password} onChange={set('password')} autoComplete="new-password" /></label>
        <label className="field"><span>Sex</span>
          <select required value={f.sex} onChange={set('sex')}>
            <option value="" disabled>Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <div className="grid2">
          <label className="field"><span>Height (cm)</span><input inputMode="decimal" type="number" step="0.1" min="50" max="260" value={f.height_cm} onChange={set('height_cm')} /></label>
          <label className="field"><span>Weight (kg)</span><input inputMode="decimal" type="number" step="0.1" min="20" max="400" value={f.current_weight_kg} onChange={set('current_weight_kg')} /></label>
        </div>
        <button className="btn primary block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="center muted" style={{ marginTop: 18 }}>Have an account? <Link to="/login">Sign in</Link></p>
    </div>
  );
}
