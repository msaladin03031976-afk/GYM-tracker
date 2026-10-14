import { useEffect, useState, type FormEvent } from 'react';
import { deleteBodyWeight, getBodyWeights, saveBodyWeight } from '../lib/api';
import { RANGES, fmtDate, rangeStart, todayISO, type RangeKey } from '../lib/dates';
import { fmtNum, fmtPct, pctChange } from '../lib/stats';
import type { BodyMeasurement } from '../types';
import Spinner from '../components/Spinner';
import TopBar from '../components/TopBar';
import TrendChart from '../components/TrendChart';

export default function BodyWeight() {
  const [rows, setRows] = useState<BodyMeasurement[] | null>(null);
  const [date, setDate] = useState(todayISO());
  const [kg, setKg] = useState('');
  const [range, setRange] = useState<RangeKey>('90d');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => getBodyWeights().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    const v = parseFloat(kg);
    if (!v || v <= 0) return;
    setBusy(true);
    try { await saveBodyWeight(date, v); setKg(''); await load(); } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  async function remove(id: number) {
    if (!confirm('Delete this entry?')) return;
    await deleteBodyWeight(id).catch((e) => setError(e.message));
    load();
  }

  if (!rows) return error ? <div className="page"><div className="error">{error}</div></div> : <Spinner />;
  const start = rangeStart(range);
  const shown = start ? rows.filter((r) => r.measured_on >= start) : rows;
  const latest = rows[rows.length - 1];
  const change = shown.length > 1 ? shown[shown.length - 1].weight_kg - shown[0].weight_kg : null;

  return (
    <div className="page">
      <TopBar back={true} />
      <h1>Body weight</h1>
      {error && <div className="error">{error}</div>}

      <div className="grid2">
        <div className="card stat"><div className="label">Current</div><div className="value">{latest ? fmtNum(latest.weight_kg) : '—'}<small> kg</small></div></div>
        <div className="card stat"><div className="label">Change ({RANGES.find((r) => r.key === range)?.label})</div>
          <div className="value">{change === null ? '—' : `${change > 0 ? '+' : ''}${fmtNum(change)}`}<small> kg</small></div>
          {change !== null && <div className="small muted">{fmtPct(pctChange(shown[0].weight_kg, shown[shown.length - 1].weight_kg))}</div>}
        </div>
      </div>

      <form className="card" onSubmit={add} style={{ marginTop: 10 }}>
        <div className="grid2">
          <label className="field"><span>Date</span><input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} /></label>
          <label className="field"><span>Weight (kg)</span><input type="number" inputMode="decimal" step="0.1" min="20" max="400" value={kg} onChange={(e) => setKg(e.target.value)} placeholder={latest ? String(latest.weight_kg) : ''} /></label>
        </div>
        <button className="btn primary block" disabled={busy || !kg}>Save weigh-in</button>
      </form>

      <div className="chips" style={{ marginTop: 16 }}>
        {RANGES.map((r) => <button key={r.key} className={`chip ${range === r.key ? 'on' : ''}`} onClick={() => setRange(r.key)}>{r.label}</button>)}
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <TrendChart unit="kg" color="var(--chart-2)" data={shown.map((r) => ({ date: r.measured_on, value: r.weight_kg }))} />
      </div>

      <h2>Entries</h2>
      <div className="card">
        {rows.length === 0 && <div className="muted small">No weigh-ins yet.</div>}
        <table className="data">
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.measured_on)}</td>
                <td><b>{fmtNum(r.weight_kg)} kg</b></td>
                <td style={{ textAlign: 'right' }}><button className="icon-btn" aria-label="Delete entry" onClick={() => remove(r.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
