import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendPoint } from '../../lib/trendSeries';
import { formatAxisMoney } from '../../lib/compactMoney';
import { formatCurrency } from '../../lib/formatters';
import { useCssVars } from '../../hooks/useCssVars';

const VARS = ['accent-fg', 'faint', 'muted', 'line', 'pop'] as const;

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
  currency: string;
  previousName: string;
}

function TrendTooltip({ active, payload, currency, previousName }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="min-w-[180px] rounded-[10px] border border-card-border bg-pop px-3 py-2.5 text-[12.5px] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-2">
        <span className="h-[2px] w-3.5 rounded-full bg-accent-fg" aria-hidden />
        <span className="text-muted">{p.currentLabel}</span>
        <span className="ml-auto font-mono font-medium text-fg">{formatCurrency(p.current ?? 0, currency)}</span>
      </div>
      {p.previous !== null && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="w-3.5 border-t-2 border-dashed border-faint" aria-hidden />
          <span className="text-muted">{p.previousLabel || previousName}</span>
          <span className="ml-auto font-mono text-muted">{formatCurrency(p.previous, currency)}</span>
        </div>
      )}
    </div>
  );
}

export interface SalesTrendChartProps {
  points: TrendPoint[];
  currency: string;
  previousName: string;
  height?: number;
  /** Grow to the parent's height (at least `height`). */
  fill?: boolean;
}

/** Sales this period (solid accent line) against the previous period (dashed, recessive). */
export function SalesTrendChart({ points, currency, previousName, height = 184, fill = false }: SalesTrendChartProps) {
  const c = useCssVars(VARS);
  const hasPrevious = points.some((p) => p.previous !== null);
  return (
    <div style={fill ? { minHeight: height, height: '100%' } : { height }} role="img" aria-label={`Sales trend, this period against ${previousName === 'yesterday' ? 'yesterday' : `the ${previousName}`}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.line} strokeWidth={1} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: c.line }}
            tick={{ fill: c.faint, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={28}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={(v: number) => formatAxisMoney(v, currency)}
            tickLine={false}
            axisLine={false}
            tick={{ fill: c.faint, fontSize: 11 }}
            tickCount={4}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: c.faint, strokeWidth: 1 }}
            content={<TrendTooltip currency={currency} previousName={previousName} />}
            isAnimationActive={false}
          />
          {hasPrevious && (
            <Line
              type="linear"
              dataKey="previous"
              stroke={c.faint}
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, fill: c.faint, stroke: c.pop, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          )}
          <Line
            type="linear"
            dataKey="current"
            stroke={c['accent-fg']}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4.5, fill: c['accent-fg'], stroke: c.pop, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
