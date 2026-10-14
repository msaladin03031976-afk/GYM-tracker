import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtDate, fmtShort } from '../lib/dates';
import { fmtNum } from '../lib/stats';

export interface Point {
  date: string;
  value: number;
  detail?: string;
}

/** Single-series line chart with crosshair tooltip. Title outside names the series, so no legend. */
export default function TrendChart({
  data, unit, color = 'var(--chart-1)', height = 240,
}: { data: Point[]; unit: string; color?: string; height?: number }) {
  if (data.length === 0) return <div className="empty">No data in this period.</div>;
  return (
    <div className="chart-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtShort} tickLine={false} axisLine={{ stroke: 'var(--border)' }} minTickGap={24} />
          <YAxis
            tickLine={false} axisLine={false} width={48}
            domain={['auto', 'auto']} tickFormatter={(v: number) => fmtNum(v)}
          />
          <Tooltip
            cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="chart-tip">
                  <div className="muted">{fmtDate(p.date)}</div>
                  <b>{fmtNum(p.value)} {unit}</b>
                  {p.detail && <div className="muted small">{p.detail}</div>}
                </div>
              );
            }}
          />
          <Line
            type="monotone" dataKey="value" stroke={color} strokeWidth={2}
            dot={{ r: 4, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
