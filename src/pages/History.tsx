import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExercises, getMuscleGroups, listSessions } from '../lib/api';
import { WEEK_STARTS_ON, addDays, fmtLong, parseISO, startOfWeek, toISO, todayISO } from '../lib/dates';
import { entryStats, fmtNum } from '../lib/stats';
import type { Exercise, MuscleGroup, Session } from '../types';
import Spinner from '../components/Spinner';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function History() {
  const nav = useNavigate();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [groupFilter, setGroupFilter] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listSessions(), getMuscleGroups(), getExercises()])
      .then(([s, g, e]) => { setSessions(s); setGroups(g); setExercises(e); })
      .catch((e) => setError(e.message));
  }, []);

  const byDate = useMemo(() => {
    const m = new Map<string, Session[]>();
    for (const s of sessions ?? []) m.set(s.workout_date, [...(m.get(s.workout_date) ?? []), s]);
    return m;
  }, [sessions]);

  const exName = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises]);

  if (error) return <div className="page"><div className="error">{error}</div></div>;
  if (!sessions) return <Spinner />;

  // Calendar grid: 6 weeks starting from the week containing the 1st
  const gridStart = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = todayISO();
  const dow = Array.from({ length: 7 }, (_, i) => DOW[(i + WEEK_STARTS_ON) % 7]);

  const query = q.trim().toLowerCase();
  const filtering = Boolean(query) || groupFilter !== null;
  const shown = filtering
    ? sessions.filter((s) =>
        (groupFilter === null || s.groups.includes(groupFilter)) &&
        (!query || s.exercises.some((we) => (exName.get(we.exercise_id) ?? '').toLowerCase().includes(query)) ||
          s.groups.some((g) => (groups.find((x) => x.id === g)?.name ?? '').toLowerCase().includes(query))))
    : selected ? byDate.get(selected) ?? [] : sessions.slice(0, 10);

  return (
    <div className="page">
      <h1>History</h1>
      <p className="sub">{sessions.length} workouts logged</p>

      <input placeholder="Search exercise or muscle group" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ marginTop: 10 }}>
        {groups.map((g) => (
          <button key={g.id} className={`chip ${groupFilter === g.id ? 'on' : ''}`} onClick={() => setGroupFilter(groupFilter === g.id ? null : g.id)}>{g.name}</button>
        ))}
      </div>

      {!filtering && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
            <b>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b>
            <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
          </div>
          <div className="cal">
            {dow.map((d) => <div key={d} className="dow">{d}</div>)}
            {days.map((d) => {
              const iso = toISO(d);
              const cls = [
                d.getMonth() !== month.getMonth() && 'other',
                byDate.has(iso) && 'has',
                iso === today && 'today',
                iso === selected && 'sel',
              ].filter(Boolean).join(' ');
              return (
                <button key={iso} className={cls} onClick={() => setSelected(selected === iso ? null : iso)}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <h2>{filtering ? `Results (${shown.length})` : selected ? fmtLong(parseISO(selected)) : 'Recent workouts'}</h2>
      {shown.length === 0 && <div className="card empty">{selected ? 'No workout on this day.' : 'Nothing found.'}</div>}
      {shown.map((s) => {
        const vol = s.exercises.reduce((t, we) => t + entryStats(we.sets).volume, 0);
        return (
          <div key={s.id} className="card tap" onClick={() => nav(`/workout/${s.id}`)}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>{parseISO(s.workout_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</h3>
              <span className="small muted">{fmtNum(vol)} kg</span>
            </div>
            <div className="chips" style={{ marginTop: 6 }}>
              {s.groups.map((g) => <span key={g} className="tag">{groups.find((x) => x.id === g)?.name}</span>)}
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              {s.exercises.map((we) => (
                <div key={we.id} className="row between" style={{ padding: '3px 0' }}>
                  <span>{exName.get(we.exercise_id)}</span>
                  <span className="muted">{we.sets.length} sets{we.sets.length ? ` · top ${fmtNum(entryStats(we.sets).maxWeight)} kg` : ''}</span>
                </div>
              ))}
              {!s.exercises.length && <span className="muted">No exercises</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
