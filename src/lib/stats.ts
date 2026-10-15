import type { ExerciseEntry, SetRow } from '../types';

/** Estimated one-rep max (Epley). A single rep returns the weight itself. */
export function est1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export interface EntryStats {
  maxWeight: number;
  repsAtMax: number;
  volume: number;
  totalReps: number;
  best1RM: number;
  setCount: number;
}

export function entryStats(sets: SetRow[]): EntryStats {
  let maxWeight = 0, repsAtMax = 0, volume = 0, totalReps = 0, best1RM = 0;
  for (const s of sets) {
    const w = Number(s.weight_kg) || 0;
    const r = Number(s.reps) || 0;
    if (w > maxWeight || (w === maxWeight && r > repsAtMax)) { maxWeight = w; repsAtMax = r; }
    volume += w * r;
    totalReps += r;
    best1RM = Math.max(best1RM, est1RM(w, r));
  }
  return { maxWeight, repsAtMax, volume, totalReps, best1RM, setCount: sets.length };
}

export type Metric = 'maxWeight' | 'best1RM' | 'volume' | 'totalReps';

export const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'maxWeight', label: 'Max weight', unit: 'kg' },
  { key: 'best1RM', label: 'Est. 1RM', unit: 'kg' },
  { key: 'volume', label: 'Volume', unit: 'kg' },
  { key: 'totalReps', label: 'Total reps', unit: 'reps' },
];

export function pctChange(from: number, to: number): number | null {
  if (!from) return null;
  return ((to - from) / from) * 100;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function fmtNum(n: number): string {
  const r = round1(n);
  return Number.isInteger(r) ? r.toLocaleString('en-US') : r.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function fmtPct(p: number | null): string {
  if (p === null || !isFinite(p)) return '—';
  const s = p > 0 ? '+' : '';
  return `${s}${p.toFixed(1)}%`;
}

/** 75 → "1 h 15 min", 40 → "40 min" */
export function fmtDuration(min: number | null | undefined): string {
  if (!min) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

export function fmtSets(sets: SetRow[]): string {
  return sets.map((s) => `${fmtNum(s.weight_kg)}×${s.reps}`).join('  ·  ');
}

export interface PRs {
  maxWeight: { value: number; reps: number; date: string } | null;
  best1RM: { value: number; date: string } | null;
  bestVolume: { value: number; date: string } | null;
  maxReps: { value: number; weight: number; date: string } | null;
  /** Best reps achieved at each weight, heaviest first. */
  repsByWeight: { weight: number; reps: number; date: string }[];
}

/** Personal records from entries (must be sorted oldest → newest). */
export function computePRs(entries: ExerciseEntry[]): PRs {
  const prs: PRs = { maxWeight: null, best1RM: null, bestVolume: null, maxReps: null, repsByWeight: [] };
  const byWeight = new Map<number, { reps: number; date: string }>();
  for (const e of entries) {
    const st = entryStats(e.sets);
    if (!e.sets.length) continue;
    if (!prs.maxWeight || st.maxWeight > prs.maxWeight.value || (st.maxWeight === prs.maxWeight.value && st.repsAtMax > prs.maxWeight.reps))
      prs.maxWeight = { value: st.maxWeight, reps: st.repsAtMax, date: e.date };
    if (!prs.best1RM || st.best1RM > prs.best1RM.value) prs.best1RM = { value: st.best1RM, date: e.date };
    if (!prs.bestVolume || st.volume > prs.bestVolume.value) prs.bestVolume = { value: st.volume, date: e.date };
    for (const s of e.sets) {
      const w = Number(s.weight_kg), r = Number(s.reps);
      const cur = byWeight.get(w);
      if (!cur || r > cur.reps) byWeight.set(w, { reps: r, date: e.date });
      if (!prs.maxReps || r > prs.maxReps.value) prs.maxReps = { value: r, weight: w, date: e.date };
    }
  }
  prs.repsByWeight = [...byWeight.entries()]
    .map(([weight, v]) => ({ weight, ...v }))
    .sort((a, b) => b.weight - a.weight);
  return prs;
}

/**
 * Detects sessions where a new heaviest-weight or best-1RM record was set
 * (compared with everything before it). Entries sorted oldest → newest.
 */
export function prEvents(entries: ExerciseEntry[]): { date: string; kind: 'weight' | '1rm'; value: number; reps?: number }[] {
  const out: { date: string; kind: 'weight' | '1rm'; value: number; reps?: number }[] = [];
  let bestW = 0, best1 = 0, first = true;
  for (const e of entries) {
    if (!e.sets.length) continue;
    const st = entryStats(e.sets);
    if (!first) {
      if (st.maxWeight > bestW) out.push({ date: e.date, kind: 'weight', value: st.maxWeight, reps: st.repsAtMax });
      else if (st.best1RM > best1 + 0.05) out.push({ date: e.date, kind: '1rm', value: st.best1RM });
    }
    bestW = Math.max(bestW, st.maxWeight);
    best1 = Math.max(best1, st.best1RM);
    first = false;
  }
  return out;
}
