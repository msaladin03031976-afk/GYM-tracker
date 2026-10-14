import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, getMuscleGroups } from '../lib/api';
import { todayISO } from '../lib/dates';
import type { MuscleGroup } from '../types';
import Spinner from '../components/Spinner';
import TopBar from '../components/TopBar';

const LABEL: Record<string, string> = { Chest: 'Chest (Bench)', Arms: 'Arms (Bi / Tri)' };

export default function StartWorkout() {
  const nav = useNavigate();
  const [groups, setGroups] = useState<MuscleGroup[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getMuscleGroups().then(setGroups).catch((e) => setError(e.message)); }, []);

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function start() {
    setBusy(true);
    try {
      const id = await createSession(date, picked);
      nav(`/workout/${id}/add`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!groups) return error ? <div className="page"><div className="error">{error}</div></div> : <Spinner />;

  return (
    <div className="page">
      <TopBar back="/" />
      <h1>Start workout</h1>
      <p className="sub">What are you training? Pick one or more.</p>
      {error && <div className="error">{error}</div>}
      <div className="big-select">
        {groups.map((g) => (
          <button key={g.id} className={picked.includes(g.id) ? 'on' : ''} onClick={() => toggle(g.id)}>
            {LABEL[g.name] || g.name}
          </button>
        ))}
      </div>
      <label className="field" style={{ marginTop: 18 }}>
        <span>Workout date</span>
        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
      </label>
      <button className="btn primary block" disabled={!picked.length || busy} onClick={start}>
        {busy ? 'Starting…' : picked.length ? 'Choose exercises' : 'Pick a muscle group'}
      </button>
    </div>
  );
}
