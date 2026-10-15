import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { entriesFromSessions, getBodyWeights, getExercises, getMuscleGroups, getProfile, listSessions } from '../lib/api';
import { fmtDate, fmtLong, startOfWeek, toISO, todayISO } from '../lib/dates';
import { entryStats, fmtDuration, fmtNum, fmtPct, pctChange, prEvents } from '../lib/stats';
import type { BodyMeasurement, Exercise, MuscleGroup, Profile, Session } from '../types';
import Spinner from '../components/Spinner';
import TrendChart from '../components/TrendChart';

export default function Dashboard() {
  const nav = useNavigate();
  const [data, setData] = useState<{
    sessions: Session[]; groups: MuscleGroup[]; exercises: Exercise[]; profile: Profile; weights: BodyMeasurement[];
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listSessions(), getMuscleGroups(), getExercises(), getProfile(), getBodyWeights()])
      .then(([sessions, groups, exercises, profile, weights]) => setData({ sessions, groups, exercises, profile, weights }))
      .catch((e) => setError(e.message));
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const { sessions, exercises } = data;
    const today = todayISO();
    const weekStart = toISO(startOfWeek(new Date()));
    const todays = sessions.filter((s) => s.workout_date === today);
    const past = sessions.filter((s) => s.workout_date < today || (s.workout_date === today && s.exercises.length));
    const lastDate = sessions.find((s) => s.workout_date < today)?.workout_date ?? null;
    const thisWeek = sessions.filter((s) => s.workout_date >= weekStart && s.workout_date <= today);
    const groupsThisWeek = new Set(thisWeek.flatMap((s) => s.groups));
    const exName = new Map(exercises.map((e) => [e.id, e.name]));

    const byEx = entriesFromSessions(sessions);
    const prs: { exId: number; date: string; text: string }[] = [];
    const trends: { exId: number; date: string; last: number; prev: number }[] = [];
    for (const [exId, list] of byEx) {
      for (const ev of prEvents(list))
        prs.push({ exId, date: ev.date, text: ev.kind === 'weight' ? `${fmtNum(ev.value)} kg × ${ev.reps}` : `Est. 1RM ${fmtNum(ev.value)} kg` });
      if (list.length >= 2) {
        const a = list[list.length - 2], b = list[list.length - 1];
        trends.push({ exId, date: b.date, prev: entryStats(a.sets).best1RM, last: entryStats(b.sets).best1RM });
      }
    }
    prs.sort((a, b) => (a.date < b.date ? 1 : -1));
    trends.sort((a, b) => (a.date < b.date ? 1 : -1));
    const weekMinutes = thisWeek.reduce((t, s) => t + (s.duration_minutes || 0), 0);
    const weekCalories = thisWeek.reduce((t, s) => t + (s.calories || 0), 0);
    return { todays, lastDate, total: past.length, thisWeek: thisWeek.length, groupsThisWeek, weekMinutes, weekCalories, prs: prs.slice(0, 4), trends: trends.slice(0, 4), exName };
  }, [data]);

  if (error) return <div className="page"><div className="error">{error}</div></div>;
  if (!data || !view) return <Spinner />;
  const { groups, profile, weights } = data;
  const firstName = profile.full_name?.split(' ')[0];

  return (
    <div className="page">
      <p className="sub" style={{ margin: 0 }}>{fmtLong(new Date())}</p>
      <h1>{firstName ? `Hi, ${firstName}` : 'Welcome'}</h1>

      {view.todays.length ? (
        <div style={{ marginTop: 16 }}>
          {view.todays.map((s) => (
            <div key={s.id} className="card tap" onClick={() => nav(`/workout/${s.id}`)}>
              <div className="row between">
                <h3>Today's workout</h3>
                <span className="tag">{s.exercises.length} exercises</span>
              </div>
              <div className="muted small">{s.groups.map((g) => groups.find((x) => x.id === g)?.name).join(' · ') || 'No muscle groups'}</div>
              <div className="small" style={{ marginTop: 6, color: 'var(--accent)' }}>Continue ›</div>
            </div>
          ))}
          <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => nav('/start')}>Start another workout</button>
        </div>
      ) : (
        <button className="btn primary block" style={{ marginTop: 16, minHeight: 60, fontSize: 18 }} onClick={() => nav('/start')}>
          Start workout
        </button>
      )}

      <div className="grid3" style={{ marginTop: 16 }}>
        <div className="card stat"><div className="label">Total</div><div className="value">{view.total}</div></div>
        <div className="card stat"><div className="label">This week</div><div className="value">{view.thisWeek}</div></div>
        <div className="card stat"><div className="label">Last</div><div className="value" style={{ fontSize: 16, marginTop: 10 }}>{view.lastDate ? fmtDate(view.lastDate, { day: 'numeric', month: 'short' }) : '—'}</div></div>
      </div>

      <div className="grid2" style={{ marginTop: 8 }}>
        <div className="card stat"><div className="label">Time this week</div><div className="value" style={{ fontSize: 20 }}>{fmtDuration(view.weekMinutes)}</div></div>
        <div className="card stat"><div className="label">Calories this week</div><div className="value" style={{ fontSize: 20 }}>{view.weekCalories ? <>{fmtNum(view.weekCalories)} <small>kcal</small></> : '—'}</div></div>
      </div>

      <h2>Muscle groups this week</h2>
      <div className="chips">
        {groups.map((g) => (
          <span key={g.id} className={`chip ${view.groupsThisWeek.has(g.id) ? 'on' : ''}`}>{g.name}</span>
        ))}
      </div>

      <h2>Latest personal records</h2>
      {view.prs.length ? view.prs.map((p, i) => (
        <Link key={i} to={`/progress/${p.exId}`} className="card tap row between" style={{ display: 'flex', color: 'inherit' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{view.exName.get(p.exId)}</div>
            <div className="muted small">{fmtDate(p.date)}</div>
          </div>
          <div style={{ fontWeight: 700 }}>🏆 {p.text}</div>
        </Link>
      )) : <div className="card muted small">Records appear once you've logged an exercise at least twice.</div>}

      <h2>Recent trends</h2>
      {view.trends.length ? view.trends.map((t) => {
        const p = pctChange(t.prev, t.last);
        return (
          <Link key={t.exId} to={`/progress/${t.exId}`} className="card tap row between" style={{ display: 'flex', color: 'inherit' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{view.exName.get(t.exId)}</div>
              <div className="muted small">Est. 1RM {fmtNum(t.prev)} → {fmtNum(t.last)} kg</div>
            </div>
            <div className={p === null ? 'muted' : p >= 0 ? 'up' : 'down'} style={{ fontWeight: 700 }}>
              {p !== null && (p >= 0 ? '▲ ' : '▼ ')}{fmtPct(p)}
            </div>
          </Link>
        );
      }) : <div className="card muted small">Log the same exercise in two workouts to see trends.</div>}

      <div className="row between" style={{ marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Body weight</h2>
        <Link to="/body-weight" className="small">Update ›</Link>
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="stat">
          <div className="label">Current</div>
          <div className="value">{profile.current_weight_kg ? <>{fmtNum(profile.current_weight_kg)} <small>kg</small></> : '—'}</div>
        </div>
        {weights.length > 1 && (
          <TrendChart height={140} unit="kg" color="var(--chart-2)" data={weights.slice(-30).map((w) => ({ date: w.measured_on, value: w.weight_kg }))} />
        )}
      </div>
    </div>
  );
}
