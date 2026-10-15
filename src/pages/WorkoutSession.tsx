import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteSession, getExerciseHistory, getExercises, getMuscleGroups, getSession, removeWorkoutExercise, setSessionGroups, updateSession,
} from '../lib/api';
import { fmtDate, fmtLong, parseISO, todayISO } from '../lib/dates';
import { entryStats, fmtDuration, fmtNum, fmtPct, fmtSets, pctChange } from '../lib/stats';
import type { Exercise, ExerciseEntry, MuscleGroup, Session } from '../types';
import Spinner from '../components/Spinner';
import TopBar from '../components/TopBar';

export default function WorkoutSession() {
  const { sessionId } = useParams();
  const id = Number(sessionId);
  const nav = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [prev, setPrev] = useState<Map<number, ExerciseEntry | null>>(new Map());
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [kcal, setKcal] = useState('');
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, g, ex] = await Promise.all([getSession(id), getMuscleGroups(), getExercises()]);
      setSession(s); setGroups(g); setExercises(ex);
      if (s.duration_minutes) {
        setHours(s.duration_minutes >= 60 ? String(Math.floor(s.duration_minutes / 60)) : '');
        setMins(String(s.duration_minutes % 60));
      }
      if (s.calories) setKcal(String(s.calories));
      // previous performance of each exercise, for comparison
      const m = new Map<number, ExerciseEntry | null>();
      await Promise.all(s.exercises.map(async (we) => {
        const hist = await getExerciseHistory(we.exercise_id);
        const before = hist.filter((h) => h.date < s.workout_date || (h.date === s.workout_date && h.workoutExerciseId < we.id));
        m.set(we.id, before[before.length - 1] ?? null);
      }));
      setPrev(m);
    } catch (e) { setError((e as Error).message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <div className="page"><TopBar back="/" /><div className="error">{error}</div></div>;
  if (!session) return <Spinner />;

  const exName = (eid: number) => exercises.find((e) => e.id === eid)?.name ?? 'Exercise';
  const totalVolume = session.exercises.reduce((t, we) => t + entryStats(we.sets).volume, 0);
  const totalSets = session.exercises.reduce((t, we) => t + we.sets.length, 0);

  async function toggleGroup(gid: number) {
    if (!session) return;
    const next = session.groups.includes(gid) ? session.groups.filter((x) => x !== gid) : [...session.groups, gid];
    setSession({ ...session, groups: next });
    await setSessionGroups(session.id, next).catch((e) => setError(e.message));
  }

  async function changeDate(d: string) {
    if (!session || !d) return;
    setSession({ ...session, workout_date: d });
    await updateSession(session.id, { workout_date: d }).catch((e) => setError(e.message));
    load();
  }

  async function removeEx(weId: number) {
    if (!confirm('Remove this exercise and its sets from the workout?')) return;
    await removeWorkoutExercise(weId).catch((e) => setError(e.message));
    load();
  }

  async function finish() {
    const total = (parseInt(hours) || 0) * 60 + (parseInt(mins) || 0);
    const cal = parseInt(kcal) || 0;
    setFinishing(true);
    try {
      await updateSession(id, { duration_minutes: total || null, calories: cal || null });
      nav('/', { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setFinishing(false);
    }
  }

  async function removeSession() {
    if (!confirm('Delete this whole workout? This cannot be undone.')) return;
    await deleteSession(id).catch((e) => setError(e.message));
    nav('/history', { replace: true });
  }

  return (
    <div className="page">
      <TopBar back={true} right={<button className="btn sm ghost" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>} />
      <p className="sub" style={{ margin: 0 }}>{session.workout_date === todayISO() ? 'Today' : 'Workout'}</p>
      <h1>{fmtLong(parseISO(session.workout_date))}</h1>

      {editing ? (
        <div className="card" style={{ marginTop: 12 }}>
          <label className="field"><span>Date</span>
            <input type="date" value={session.workout_date} max={todayISO()} onChange={(e) => changeDate(e.target.value)} />
          </label>
          <span className="small muted">Muscle groups</span>
          <div className="chips" style={{ marginTop: 6 }}>
            {groups.map((g) => (
              <button key={g.id} className={`chip ${session.groups.includes(g.id) ? 'on' : ''}`} onClick={() => toggleGroup(g.id)}>{g.name}</button>
            ))}
          </div>
          <button className="btn danger block" style={{ marginTop: 16 }} onClick={removeSession}>Delete workout</button>
        </div>
      ) : (
        <div className="chips" style={{ marginTop: 8 }}>
          {session.groups.map((gid) => <span key={gid} className="tag">{groups.find((g) => g.id === gid)?.name}</span>)}
        </div>
      )}

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card stat"><div className="label">Sets</div><div className="value">{totalSets}</div></div>
        <div className="card stat"><div className="label">Volume</div><div className="value">{fmtNum(totalVolume)} <small>kg</small></div></div>
        <div className="card stat"><div className="label">Time</div><div className="value" style={{ fontSize: 20 }}>{fmtDuration(session.duration_minutes)}</div></div>
        <div className="card stat"><div className="label">Calories</div><div className="value">{session.calories ? <>{fmtNum(session.calories)} <small>kcal</small></> : '—'}</div></div>
      </div>

      <h2>Exercises</h2>
      {session.exercises.length === 0 && <div className="card empty">No exercises yet. Add your first one.</div>}
      {session.exercises.map((we) => {
        const st = entryStats(we.sets);
        const p = prev.get(we.id);
        const pst = p ? entryStats(p.sets) : null;
        const change = pst ? pctChange(pst.volume, st.volume) : null;
        return (
          <div key={we.id} className="card tap" onClick={() => !editing && nav(`/workout/${id}/exercise/${we.id}`)}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>{exName(we.exercise_id)}</h3>
              {editing ? (
                <button className="icon-btn" aria-label="Remove exercise" onClick={(e) => { e.stopPropagation(); removeEx(we.id); }}>✕</button>
              ) : (
                <span className="muted">›</span>
              )}
            </div>
            <div className="small" style={{ marginTop: 6 }}>{we.sets.length ? fmtSets(we.sets) : <span className="muted">No sets logged — tap to add</span>}</div>
            {we.sets.length > 0 && (
              <div className="row small muted" style={{ marginTop: 6, gap: 14 }}>
                <span>Volume {fmtNum(st.volume)} kg</span>
                {pst && (
                  <span>
                    vs {fmtDate(p!.date, { day: 'numeric', month: 'short' })}:{' '}
                    <b className={change === null ? '' : change >= 0 ? 'up' : 'down'}>{fmtPct(change)}</b>
                  </span>
                )}
              </div>
            )}
            {we.notes && <div className="small muted" style={{ marginTop: 6 }}>📝 {we.notes}</div>}
          </div>
        );
      })}

      <Link to={`/workout/${id}/add`} className="btn primary block" style={{ marginTop: 14 }}>+ Add exercise</Link>
      <h2>Finish workout</h2>
      <div className="card">
        <span className="small muted">Total time spent</span>
        <div className="grid2" style={{ marginTop: 6 }}>
          <label className="field" style={{ marginBottom: 8 }}><span>Hours</span>
            <input type="number" inputMode="numeric" min="0" max="23" placeholder="0" value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
          <label className="field" style={{ marginBottom: 8 }}><span>Minutes</span>
            <input type="number" inputMode="numeric" min="0" max="59" placeholder="0" value={mins} onChange={(e) => setMins(e.target.value)} />
          </label>
        </div>
        <label className="field"><span>Total calories burned (kcal)</span>
          <input type="number" inputMode="numeric" min="0" placeholder="e.g. 450" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        </label>
        <button className="btn primary block" disabled={finishing} onClick={finish}>
          {finishing ? 'Saving…' : 'Save & finish workout'}
        </button>
      </div>
    </div>
  );
}
