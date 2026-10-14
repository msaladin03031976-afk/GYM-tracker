import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getExerciseHistory, getExercises } from '../lib/api';
import { RANGES, fmtDate, rangeStart, type RangeKey } from '../lib/dates';
import { METRICS, computePRs, entryStats, fmtNum, fmtPct, fmtSets, pctChange, type Metric } from '../lib/stats';
import type { ExerciseEntry } from '../types';
import Spinner from '../components/Spinner';
import TopBar from '../components/TopBar';
import TrendChart from '../components/TrendChart';

export default function ExerciseAnalytics() {
  const { exerciseId } = useParams();
  const exId = Number(exerciseId);
  const [name, setName] = useState('');
  const [all, setAll] = useState<ExerciseEntry[] | null>(null);
  const [range, setRange] = useState<RangeKey>('all');
  const [metric, setMetric] = useState<Metric>('maxWeight');
  const [repWeight, setRepWeight] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getExerciseHistory(exId), getExercises()])
      .then(([h, ex]) => { setAll(h); setName(ex.find((e) => e.id === exId)?.name ?? 'Exercise'); })
      .catch((e) => setError(e.message));
  }, [exId]);

  const entries = useMemo(() => {
    if (!all) return [];
    const start = rangeStart(range);
    return start ? all.filter((e) => e.date >= start) : all;
  }, [all, range]);

  const prs = useMemo(() => computePRs(all ?? []), [all]);

  // Weights the user has lifted, for the "reps at weight" chart
  const weights = useMemo(() => {
    const set = new Set<number>();
    for (const e of all ?? []) for (const s of e.sets) set.add(s.weight_kg);
    return [...set].sort((a, b) => b - a);
  }, [all]);

  useEffect(() => {
    if (repWeight === null && weights.length) {
      // default to the weight used most often
      const counts = new Map<number, number>();
      for (const e of all ?? []) for (const s of e.sets) counts.set(s.weight_kg, (counts.get(s.weight_kg) ?? 0) + 1);
      setRepWeight([...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]);
    }
  }, [weights, all, repWeight]);

  if (error) return <div className="page"><TopBar back={true} /><div className="error">{error}</div></div>;
  if (!all) return <Spinner />;

  if (!all.length) {
    return (
      <div className="page">
        <TopBar back={true} />
        <h1>{name}</h1>
        <div className="card empty">No sets logged for this exercise yet.</div>
      </div>
    );
  }

  const m = METRICS.find((x) => x.key === metric)!;
  const points = entries.map((e) => {
    const st = entryStats(e.sets);
    return { date: e.date, value: Math.round(st[metric] * 10) / 10, detail: fmtSets(e.sets) };
  });
  const firstMax = entries.length ? entryStats(entries[0].sets).maxWeight : 0;
  const lastMax = entries.length ? entryStats(entries[entries.length - 1].sets).maxWeight : 0;
  const headPct = entries.length > 1 ? pctChange(firstMax, lastMax) : null;

  const repPoints = repWeight === null ? [] : entries
    .map((e) => {
      const at = e.sets.filter((s) => s.weight_kg === repWeight);
      return at.length ? { date: e.date, value: Math.max(...at.map((s) => s.reps)), detail: `${at.length} set(s) at ${fmtNum(repWeight)} kg` } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Comparison table: latest session vs previous, and vs start of each period
  const latest = all[all.length - 1];
  const latestSt = entryStats(latest.sets);
  const comparisons: { label: string; base: ExerciseEntry | null }[] = [
    { label: 'Previous workout', base: all.length > 1 ? all[all.length - 2] : null },
    ...RANGES.map((r) => {
      const start = rangeStart(r.key);
      const base = start ? all.find((e) => e.date >= start) ?? null : all[0];
      return { label: r.key === 'all' ? 'All time (first)' : `Last ${r.label.replace('D', ' days').replace('M', ' months')}`, base: base && base !== latest ? base : null };
    }),
  ];

  return (
    <div className="page">
      <TopBar back={true} />
      <h1>{name}</h1>
      <p className="sub">{all.length} sessions logged</p>

      {/* Headline: max weight change over the selected period */}
      <div className="card">
        <div className="row between">
          <span className="small muted">Max weight per session</span>
          {headPct !== null && <b className={headPct >= 0 ? 'up' : 'down'} style={{ fontSize: 20 }}>{fmtPct(headPct)}</b>}
        </div>
        <div className="grid3" style={{ marginTop: 10 }}>
          <div className="stat"><div className="label">Start</div><div className="value">{fmtNum(firstMax)}<small> kg</small></div></div>
          <div className="stat"><div className="label">Latest</div><div className="value">{fmtNum(lastMax)}<small> kg</small></div></div>
          <div className="stat"><div className="label">Change</div>
            <div className={`value ${lastMax - firstMax >= 0 ? 'up' : 'down'}`}>{lastMax - firstMax >= 0 ? '+' : ''}{fmtNum(lastMax - firstMax)}<small> kg</small></div>
          </div>
        </div>
      </div>

      <div className="chips" style={{ marginTop: 14 }}>
        {RANGES.map((r) => (
          <button key={r.key} className={`chip ${range === r.key ? 'on' : ''}`} onClick={() => setRange(r.key)}>{r.label}</button>
        ))}
      </div>

      <h2>{m.label} <span className="muted small">({m.unit})</span></h2>
      <div className="chips" style={{ marginBottom: 8 }}>
        {METRICS.map((x) => (
          <button key={x.key} className={`chip ${metric === x.key ? 'on' : ''}`} onClick={() => setMetric(x.key)}>{x.label}</button>
        ))}
      </div>
      <div className="card"><TrendChart data={points} unit={m.unit} /></div>

      <h2>Reps at a given weight</h2>
      <select value={repWeight ?? ''} onChange={(e) => setRepWeight(Number(e.target.value))}>
        {weights.map((w) => <option key={w} value={w}>{fmtNum(w)} kg</option>)}
      </select>
      <div className="card" style={{ marginTop: 10 }}><TrendChart data={repPoints} unit="reps" color="var(--chart-2)" height={200} /></div>

      <h2>Personal records</h2>
      <div className="grid2">
        <div className="card stat"><div className="label">Heaviest</div>
          <div className="value">{fmtNum(prs.maxWeight!.value)}<small> kg × {prs.maxWeight!.reps}</small></div>
          <div className="small muted">{fmtDate(prs.maxWeight!.date)}</div></div>
        <div className="card stat"><div className="label">Best est. 1RM</div>
          <div className="value">{fmtNum(prs.best1RM!.value)}<small> kg</small></div>
          <div className="small muted">{fmtDate(prs.best1RM!.date)}</div></div>
        <div className="card stat"><div className="label">Best volume</div>
          <div className="value">{fmtNum(prs.bestVolume!.value)}<small> kg</small></div>
          <div className="small muted">{fmtDate(prs.bestVolume!.date)}</div></div>
        <div className="card stat"><div className="label">Most reps</div>
          <div className="value">{prs.maxReps!.value}<small> @ {fmtNum(prs.maxReps!.weight)} kg</small></div>
          <div className="small muted">{fmtDate(prs.maxReps!.date)}</div></div>
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="small muted" style={{ marginBottom: 6 }}>Max reps at each weight</div>
        <table className="data">
          <thead><tr><th>Weight</th><th>Best reps</th><th>Date</th></tr></thead>
          <tbody>
            {prs.repsByWeight.slice(0, 8).map((r) => (
              <tr key={r.weight}><td>{fmtNum(r.weight)} kg</td><td>{r.reps}</td><td className="muted">{fmtDate(r.date)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Progress comparison</h2>
      <p className="small muted" style={{ marginTop: -4 }}>Latest workout ({fmtDate(latest.date)}) compared with…</p>
      <div className="card">
        <table className="data">
          <thead><tr><th></th><th>Max kg</th><th>Est. 1RM</th><th>Volume</th></tr></thead>
          <tbody>
            {comparisons.map((c) => {
              if (!c.base) return <tr key={c.label}><td>{c.label}</td><td className="muted" colSpan={3}>not enough data</td></tr>;
              const b = entryStats(c.base.sets);
              const cell = (from: number, to: number) => {
                const p = pctChange(from, to);
                return <td className={p === null ? '' : p >= 0 ? 'up' : 'down'}>{fmtPct(p)}</td>;
              };
              return (
                <tr key={c.label}>
                  <td>{c.label}</td>
                  {cell(b.maxWeight, latestSt.maxWeight)}
                  {cell(b.best1RM, latestSt.best1RM)}
                  {cell(b.volume, latestSt.volume)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button className="btn ghost block" style={{ marginTop: 14 }} onClick={() => setShowTable(!showTable)}>
        {showTable ? 'Hide' : 'Show'} all sessions
      </button>
      {showTable && (
        <div className="card" style={{ marginTop: 10 }}>
          <table className="data">
            <thead><tr><th>Date</th><th>Sets</th><th>Volume</th></tr></thead>
            <tbody>
              {[...entries].reverse().map((e) => (
                <tr key={e.workoutExerciseId}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.date, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                  <td className="small">{fmtSets(e.sets)}</td>
                  <td>{fmtNum(entryStats(e.sets).volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
