import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addCustomExercise, addExerciseToSession, getExercises, getMuscleGroups, getSession } from '../lib/api';
import type { Exercise, MuscleGroup, Session } from '../types';
import Spinner from '../components/Spinner';
import TopBar from '../components/TopBar';

export default function ExercisePicker() {
  const { sessionId } = useParams();
  const id = Number(sessionId);
  const nav = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [tab, setTab] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getSession(id), getMuscleGroups(), getExercises()])
      .then(([s, g, ex]) => {
        setSession(s); setGroups(g); setExercises(ex);
        setTab(s.groups[0] ?? g[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error && !session) return <div className="page"><TopBar back={true} /><div className="error">{error}</div></div>;
  if (!session || tab === null) return <Spinner />;

  // Tabs: the session's groups first, then the rest
  const ordered = [...groups].sort((a, b) => {
    const ia = session.groups.includes(a.id) ? 0 : 1, ib = session.groups.includes(b.id) ? 0 : 1;
    return ia - ib || a.sort_order - b.sort_order;
  });
  const done = new Set(session.exercises.map((e) => e.exercise_id));
  const query = q.trim().toLowerCase();
  const list = exercises.filter((e) => (query ? e.name.toLowerCase().includes(query) : e.muscle_group_id === tab));

  async function pick(ex: Exercise) {
    setBusy(true);
    try {
      const existing = session!.exercises.find((w) => w.exercise_id === ex.id);
      const weId = existing ? existing.id : await addExerciseToSession(id, ex.id);
      nav(`/workout/${id}/exercise/${weId}`, { replace: true });
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  async function createCustom(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const ex = await addCustomExercise(newName, tab!);
      await pick(ex);
    } catch (err) {
      const m = (err as Error).message;
      setError(m.includes('duplicate') ? 'You already have an exercise with that name.' : m);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <TopBar back={`/workout/${id}`} />
      <h1>Choose exercise</h1>
      {error && <div className="error">{error}</div>}
      <input placeholder="Search all exercises" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {!query && (
        <div className="chips" style={{ marginBottom: 12 }}>
          {ordered.map((g) => (
            <button key={g.id} className={`chip ${tab === g.id ? 'on' : ''}`} onClick={() => setTab(g.id)}>{g.name}</button>
          ))}
        </div>
      )}
      {list.map((ex) => (
        <button key={ex.id} className="card tap row between" style={{ width: '100%', textAlign: 'left', display: 'flex' }} disabled={busy} onClick={() => pick(ex)}>
          <span style={{ fontWeight: 600 }}>{ex.name}</span>
          <span className="row" style={{ gap: 6 }}>
            {ex.is_custom && <span className="tag">Custom</span>}
            {done.has(ex.id) ? <span className="tag" style={{ color: 'var(--accent)' }}>✓ Added</span> : <span className="muted">＋</span>}
          </span>
        </button>
      ))}
      {list.length === 0 && <div className="empty">No exercises found.</div>}

      {!query && (adding ? (
        <form className="card" onSubmit={createCustom} style={{ marginTop: 14 }}>
          <label className="field"><span>New {groups.find((g) => g.id === tab)?.name} exercise</span>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Smith Machine Press" />
          </label>
          <div className="row">
            <button type="button" className="btn ghost grow" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn primary grow" disabled={busy || !newName.trim()}>Add</button>
          </div>
        </form>
      ) : (
        <button className="btn ghost block" style={{ marginTop: 14 }} onClick={() => setAdding(true)}>+ Custom exercise</button>
      ))}
    </div>
  );
}
