import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SITE_URL, supabase } from '../supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${SITE_URL}/reset-password` });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="page no-nav">
      <div className="topbar"><Link className="back" to="/login">‹ Back</Link></div>
      <h1>Reset password</h1>
      {sent ? (
        <div className="notice">If an account exists for {email}, a reset link is on its way. Open it on this phone to set a new password.</div>
      ) : (
        <form onSubmit={submit}>
          <p className="sub">Enter your email and we'll send you a link to set a new password.</p>
          {error && <div className="error">{error}</div>}
          <label className="field"><span>Email</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn primary block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </div>
  );
}
