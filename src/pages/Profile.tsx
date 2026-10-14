import { useEffect, useState, type FormEvent } from 'react';
import { getProfile, saveBodyWeight, updateProfile } from '../lib/api';
import { fmtDate, todayISO } from '../lib/dates';
import type { Profile, Sex } from '../types';
import Spinner from '../components/Spinner';
import TopBar from '../components/TopBar';
import Toast, { useToast } from '../components/Toast';

export default function ProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
  const [f, setF] = useState({ full_name: '', sex: '', height_cm: '', weight: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();

  useEffect(() => {
    getProfile().then((pr) => {
      setP(pr);
      setF({ full_name: pr.full_name ?? '', sex: pr.sex ?? '', height_cm: pr.height_cm?.toString() ?? '', weight: pr.current_weight_kg?.toString() ?? '' });
    }).catch((e) => setError(e.message));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!p) return;
    setBusy(true);
    setError('');
    try {
      await updateProfile({
        full_name: f.full_name.trim() || null,
        sex: (f.sex || null) as Sex | null,
        height_cm: f.height_cm ? Number(f.height_cm) : null,
      });
      const w = parseFloat(f.weight);
      if (w && w !== p.current_weight_kg) await saveBodyWeight(todayISO(), w); // also logs today's weigh-in
      setP(await getProfile());
      showToast('Profile saved');
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  if (!p) return error ? <div className="page"><div className="error">{error}</div></div> : <Spinner />;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="page">
      <TopBar back="/settings" />
      <h1>Profile</h1>
      <p className="sub">{p.email} · member since {fmtDate(p.created_at.slice(0, 10))}</p>
      {error && <div className="error">{error}</div>}
      <form onSubmit={save}>
        <label className="field"><span>Full name</span><input value={f.full_name} onChange={set('full_name')} /></label>
        <label className="field"><span>Sex</span>
          <select value={f.sex} onChange={set('sex')}>
            <option value="">Not set</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <div className="grid2">
          <label className="field"><span>Height (cm)</span><input type="number" inputMode="decimal" step="0.1" value={f.height_cm} onChange={set('height_cm')} /></label>
          <label className="field"><span>Weight (kg)</span><input type="number" inputMode="decimal" step="0.1" value={f.weight} onChange={set('weight')} /></label>
        </div>
        <p className="small muted" style={{ marginTop: -4 }}>Changing your weight here also records today's weigh-in.</p>
        <button className="btn primary block" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>
      <p className="small muted" style={{ marginTop: 18 }}>User ID: <code style={{ fontSize: 11 }}>{p.id}</code></p>
      <Toast msg={toast} />
    </div>
  );
}
