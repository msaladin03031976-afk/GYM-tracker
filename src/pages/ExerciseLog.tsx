import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getExerciseHistory, getExercises, getSession, saveSets } from '../lib/api';
import { fmtDate } from '../lib/dates';
import { computePRs, entryStats, fmtNum, fmtPct, fmtSets, pctChange } from '../lib/stats';
import type { ExerciseEntry, SetRow } from '../types';
import Spinner from '../components/Spinner';
import TopBar from '../components/TopBar';
import Toast, { useToast } from '../components/Toast';

interface Draft { weight: string; reps: string }

const WEIGHT_STEP = 2.5;

export default function ExerciseLog() {
  const { sessionId, weId } = useParams();
  const sid = Number(sessionId), wid = Number(weId);
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [notes, setNotes] = useState('');
  const [last, setLast] = useState<ExerciseEntry | null>(null);
  const [before, setBefore] = useState<ExerciseEntry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, showToast] = useToast();

  useEffect(() => {
    (async () => {
      try {
        const [s, ex] = await Promise.all([getSession(sid), getExercises()]);
        const we = s.exercises.find((w) => w.id === wid);
        if (!we) throw new Error('Exercise not found in this workout.');
        setExerciseId(we.exercise_id);
        setName(ex.find((e) => e.id === we.exercise_id)?.name ?? 'Exercise');
        setNotes(we.notes ?? '');
        const hist = await getExerciseHistory(we.exercise_id);
        const prior = hist.filter((h) => h.workoutExerciseId !== wid && (h.date < s.workout_date || (h.date === s.workout_date && h.workoutExerciseId < wid)));
        setBefore(prior);
        const prev = prior[prior.length - 1] ?? null;
        setLast(prev);
        if (we.sets.length) setRows(we.sets.map((x) => ({ weight: String(x.weight_kg), reps: String(x.reps) })));
        else if (prev) setRows([{ weight: String(prev.sets[0].weight_kg), reps: '' }]);
        else setRows([{ weight: '', reps: '' }]);
      } catch (e) { setError((e as Error).message); }
    })();
  }, [sid, wid]);

  const current: SetRow[] = useMemo(
    () => (rows ?? [])
      .map((r, i) => ({ set_number: i + 1, weight_kg: parseFloat(r.weight) || 0, reps: parseInt(r.reps) || 0 }))
      .filter((s) => s.reps > 0),
    [rows]
  );
  const st = entryStats(current);
  const lastSt = last ? entryStats(last.sets) : null;
  const prs = useMemo(() => computePRs(before), [before]);
  const isWeightPR = before.length > 0 && prs.maxWeight && st.maxWeight > prs.maxWeight.value;
  const is1RMPR = before.length > 0 && prs.best1RM && st.best1RM > prs.best1RM.value + 0.05;

  if (error && !rows) return <div className="page"><TopBar back={`/workout/${sid}`} /><div className="error">{error}</div></div>;
  if (!rows) return <Spinner />;

  const update = (i: number, patch: Partial<Draft>) => {
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const bump = (i: number, field: 'weight' | 'reps', delta: number) => {
    const cur = field === 'weight' ? parseFloat(rows[i].weight) || 0 : parseInt(rows[i].reps) || 0;
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100);
    update(i, { [field]: String(next) });
  };
  const addSet = () => {
    const prevRow = rows[rows.length - 1];
    setRows([...rows, { weight: prevRow?.weight ?? '', reps: prevRow?.reps ?? '' }]);
    setDirty(true);
  };
  const removeSet = (i: number) => { setRows(rows.filter((_, j) => j !== i)); setDirty(true); };
  const copyLast = () => {
    if (!last) return;
    setRows(last.sets.map((s) => ({ weight: String(s.weight_kg), reps: String(s.reps) })));
    setDirty(true);
    showToast('Copied last workout');
  };

  async function save(goBack: boolean) {
    setBusy(true);
    setError('');
    try {
      await saveSets(wid, current, notes.trim() || null);
      setDirty(false);
      if (goBack) nav(`/workout/${sid}`, { replace: true });
      else showToast('Saved');
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  const volChange = lastSt && current.length ? pctChange(lastSt.volume, st.volume) : null;

  return (
    <div className="page">
      <TopBar
        back={`/workout/${sid}`}
        right={exerciseId ? <Link to={`/progress/${exerciseId}`} className="btn sm ghost">📈 Progress</Link> : null}
      />
      <h1>{name}</h1>
      {error && <div className="error">{error}</div>}

      {last ? (
        <div className="lasttime">
          <div className="row between">
            <span className="small muted">Last time · {fmtDate(last.date)}</span>
            <button className="btn sm" onClick={copyLast}>Copy</button>
          </div>
          <div style={{ fontWeight: 600, marginTop: 6 }}>{fmtSets(last.sets)}</div>
          <div className="small muted" style={{ marginTop: 4 }}>
            Top set {fmtNum(lastSt!.maxWeight)} kg × {lastSt!.repsAtMax} · Volume {fmtNum(lastSt!.volume)} kg
            {prs.maxWeight && <> · Best ever {fmtNum(prs.maxWeight.value)} kg</>}
          </div>
        </div>
      ) : (
        <div className="lasttime small muted">First time logging this exercise — this sets your baseline.</div>
      )}

      <div className="card">
        {rows.map((r, i) => (
          <div className="set-row" key={i}>
            <div className="set-num">{i + 1}</div>
            <div>
              <div className="stepper">
                <button aria-label="Less weight" onClick={() => bump(i, 'weight', -WEIGHT_STEP)}>−</button>
                <input inputMode="decimal" type="number" step="0.5" min="0" placeholder="0" value={r.weight} onChange={(e) => update(i, { weight: e.target.value })} aria-label={`Set ${i + 1} weight`} />
                <button aria-label="More weight" onClick={() => bump(i, 'weight', WEIGHT_STEP)}>+</button>
              </div>
              <div className="stepper-label">kg</div>
            </div>
            <div>
              <div className="stepper">
                <button aria-label="Fewer reps" onClick={() => bump(i, 'reps', -1)}>−</button>
                <input inputMode="numeric" type="number" step="1" min="0" placeholder="0" value={r.reps} onChange={(e) => update(i, { reps: e.target.value })} aria-label={`Set ${i + 1} reps`} />
                <button aria-label="More reps" onClick={() => bump(i, 'reps', 1)}>+</button>
              </div>
              <div className="stepper-label">reps{last?.sets[i] ? ` · last ${fmtNum(last.sets[i].weight_kg)}×${last.sets[i].reps}` : ''}</div>
            </div>
            <button className="icon-btn" aria-label={`Delete set ${i + 1}`} onClick={() => removeSet(i)}>✕</button>
          </div>
        ))}
        <button className="btn block" style={{ marginTop: 10 }} onClick={addSet}>+ Add set</button>
      </div>

      <div className="grid3" style={{ marginTop: 10 }}>
        <div className="card stat"><div className="label">Sets</div><div className="value">{current.length}</div></div>
        <div className="card stat"><div className="label">Volume</div><div className="value" style={{ fontSize: 20 }}>{fmtNum(st.volume)}</div></div>
        <div className="card stat"><div className="label">vs last</div>
          <div className={`value ${volChange === null ? '' : volChange >= 0 ? 'up' : 'down'}`} style={{ fontSize: 20 }}>{fmtPct(volChange)}</div>
        </div>
      </div>
      {(isWeightPR || is1RMPR) && (
        <div className="notice" style={{ marginTop: 10 }}>
          🏆 New personal record{isWeightPR ? ` — heaviest weight: ${fmtNum(st.maxWeight)} kg` : ` — est. 1RM ${fmtNum(st.best1RM)} kg`}
        </div>
      )}

      <label className="field" style={{ marginTop: 14 }}><span>Notes (optional)</span>
        <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true); }} placeholder="e.g. felt strong, use spotter next time" />
      </label>

      <button className="btn primary block" disabled={busy} onClick={() => save(true)}>{busy ? 'Saving…' : 'Save exercise'}</button>
      {dirty && <p className="small muted center">Unsaved changes</p>}
      <Toast msg={toast} />
    </div>
  );
}
