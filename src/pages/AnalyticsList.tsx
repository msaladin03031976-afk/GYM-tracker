import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { entriesFromSessions, getExercises, getMuscleGroups, listSessions } from '../lib/api';
import { fmtDate } from '../lib/dates';
import { entryStats, fmtNum, fmtPct, pctChange } from '../lib/stats';
import type { Exercise, ExerciseEntry, MuscleGroup } from '../types';
import Spinner from '../components/Spinner';

export default function AnalyticsList() {
  const [byEx, setByEx] = useState<Map<number, ExerciseEntry[]> | null>(null);
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [tab, setTab] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listSessions(), getMuscleGroups(), getExercises()])
      .then(([s, g, e]) => { setByEx(entriesFromSessions(s)); setGroups(g); setExercises(e); })
      .catch((e) => setError(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!byEx) return [];
    return exercises
      .filter((e) => byEx.has(e.id) && (tab === null || e.muscle_group_id === tab))
      .map((e) => {
        const list = byEx.get(e.id)!;
        const first = entryStats(list[0].sets), last = entryStats(list[list.length - 1].sets);
        return { ex: e, count: list.length, lastDate: list[list.length - 1].date, first: first.maxWeight, last: last.maxWeight };
      })
      .sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
  }, [byEx, exercises, tab]);

  if (error) return <div className="page"><div className="error">{error}</div></div>;
  if (!byEx) return <Spinner />;

  return (
    <div className="page">
      <h1>Progress</h1>
      <p className="sub">Pick an exercise to see its trends and records.</p>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button className={`chip ${tab === null ? 'on' : ''}`} onClick={() => setTab(null)}>All</button>
        {groups.map((g) => (
          <button key={g.id} className={`chip ${tab === g.id ? 'on' : ''}`} onClick={() => setTab(g.id)}>{g.name}</button>
        ))}
      </div>
      {rows.length === 0 && <div className="card empty">No logged exercises yet. Finish a workout to start tracking progress.</div>}
      {rows.map((r) => {
        const p = r.count > 1 ? pctChange(r.first, r.last) : null;
        return (
          <Link key={r.ex.id} to={`/progress/${r.ex.id}`} className="card tap" style={{ display: 'block', color: 'inherit' }}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>{r.ex.name}</h3>
              {p !== null && <b className={p >= 0 ? 'up' : 'down'}>{p >= 0 ? '▲' : '▼'} {fmtPct(p)}</b>}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {r.count} sessions · {fmtNum(r.first)} → {fmtNum(r.last)} kg · last {fmtDate(r.lastDate, { day: 'numeric', month: 'short' })}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
