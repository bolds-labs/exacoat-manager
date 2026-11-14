import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import {
  aggregateTimelineByGranularity,
  type DailyFinancialPoint,
  type FinancialChannel,
  type FinancialGranularity,
} from '../../lib/financialAnalyticsService';
import { formatCurrency } from '../../lib/formatters';
import { formatAxisMoney } from '../../lib/compactMoney';
import { useCssVars } from '../../hooks/useCssVars';
import { MONTHLY_MIN_DAYS, resolveGranularity } from '../../lib/chartGranularity';
import { Card } from '../ds/Card';
import { Tabs } from '../ds/Tabs';
import { CHANNEL_DOT } from '../dashboard/ChannelSalesList';

type ChartMode = 'channels' | 'stacked' | 'payout';

const VARS = ['viz-1', 'viz-2', 'viz-3', 'accent-fg', 'muted', 'faint', 'line', 'pop', 'card'] as const;
const CHANNEL_VAR: Record<FinancialChannel, (typeof VARS)[number]> = { webstore: 'viz-1', shopee: 'viz-2', tiktok: 'viz-3' };

interface RevenueChartProps {
  timeline: DailyFinancialPoint[];
  selectedChannels: FinancialChannel[];
  channelLabels: Record<FinancialChannel, string>;
  currency: string;
}

interface TipProps {
  active?: boolean;
  payload?: Array<{ payload: DailyFinancialPoint }>;
  channels: FinancialChannel[];
  labels: Record<FinancialChannel, string>;
  currency: string;
}

const Row = ({ label, value, tone = 'text-fg', dot, dash }: { label: string; value: string; tone?: string; dot?: string; dash?: boolean }) => (
  <div className="flex items-center gap-2">
    {dot && <span className={`h-2 w-2 flex-none rounded-full ${dot}`} aria-hidden />}
    {dash && <span className="w-3 flex-none border-t-2 border-muted" aria-hidden />}
    <span className="text-muted">{label}</span>
    <span className={`ml-auto pl-4 font-mono tabular-nums ${tone}`}>{value}</span>
  </div>
);

function RevenueTooltip({ active, payload, channels, labels, currency }: TipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const money = (v: number) => formatCurrency(v, currency);
  const cleanKey: Record<FinancialChannel, keyof DailyFinancialPoint> = { webstore: 'webstoreClean', shopee: 'shopeeClean', tiktok: 'tiktokClean' };
  return (
    <div className="min-w-[250px] rounded-[10px] border border-card-border bg-pop px-3 py-2.5 text-[12.5px] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <div className="mb-2 flex items-center justify-between gap-4 border-b border-line pb-1.5">
        <span className="font-medium text-fg">{d.fullLabel || d.date}</span>
        <span className="text-muted">
          {d.orders} paid {d.orders === 1 ? 'order' : 'orders'}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {channels.map((ch) => (
          <div key={ch}>
            <Row label={labels[ch]} value={money(d[ch])} dot={CHANNEL_DOT[ch]} />
            {(d[cleanKey[ch]] as number) > 0 && (
              <div className="pl-4 text-[11.5px]">
                <Row label="Payout" value={money(d[cleanKey[ch]] as number)} tone="text-muted" />
              </div>
            )}
          </div>
        ))}
        <div className="mt-1 flex flex-col gap-1 border-t border-line pt-1.5">
          <Row label="Gross sales" value={money(d.total)} />
          {d.totalPlatformFees > 0 && <Row label="Platform fees" value={`-${money(d.totalPlatformFees)}`} tone="text-st-stop-fg" />}
          <Row label="Payout after fees" value={money(d.totalClean)} tone="text-st-done-fg" />
          <Row label="Buyer paid" value={money(d.totalBuyerPaid)} tone="text-muted" />
          {d.totalVoucherSubsidy > 0 && <Row label="Platform vouchers" value={`-${money(d.totalVoucherSubsidy)}`} tone="text-muted" />}
          {d.cancelledOrders > 0 && (
            <Row label="Cancelled (left out)" value={`${d.cancelledOrders} (${money(d.cancelledGross)})`} tone="text-faint" />
          )}
        </div>
      </div>
    </div>
  );
}

/** Gross sales over time, per channel, stacked, or gross against payout after fees. */
export function RevenueChart({ timeline, selectedChannels, channelLabels, currency }: RevenueChartProps) {
  const [mode, setMode] = useState<ChartMode>('channels');
  const [selectedGranularity, setGranularity] = useState<FinancialGranularity>('daily');
  // Monthly disappears for short ranges; draw and highlight Daily then
  const granularity = resolveGranularity(selectedGranularity, timeline.length);
  const c = useCssVars(VARS);
  const points = useMemo(() => aggregateTimelineByGranularity(timeline, granularity), [timeline, granularity]);
  const channels = (['webstore', 'shopee', 'tiktok'] as FinancialChannel[]).filter((ch) => selectedChannels.includes(ch));

  const granularityItems = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    ...(timeline.length >= MONTHLY_MIN_DAYS ? [{ key: 'monthly', label: 'Monthly' }] : []),
  ];
  const modeItems = [
    { key: 'channels', label: 'By channel' },
    { key: 'stacked', label: 'Stacked' },
    { key: 'payout', label: 'Gross vs payout' },
  ];

  const axisProps = {
    x: {
      dataKey: 'label',
      tickLine: false,
      axisLine: { stroke: c.line },
      tick: { fill: c.faint, fontSize: 11 },
      interval: 'preserveStartEnd' as const,
      minTickGap: 28,
      tickMargin: 8,
    },
    y: {
      tickFormatter: (v: number) => formatAxisMoney(v, currency),
      tickLine: false,
      axisLine: false,
      tick: { fill: c.faint, fontSize: 11 },
      tickCount: 5,
      width: 56,
    },
  };
  const grid = <CartesianGrid vertical={false} stroke={c.line} strokeWidth={1} />;
  const tooltip = (
    <Tooltip
      cursor={mode === 'stacked' ? { fill: c.line } : { stroke: c.faint, strokeWidth: 1 }}
      content={<RevenueTooltip channels={channels} labels={channelLabels} currency={currency} />}
      isAnimationActive={false}
    />
  );
  const unit = granularity === 'daily' ? 'days' : granularity === 'weekly' ? 'weeks' : 'months';

  const legend =
    mode === 'payout'
      ? [
          { key: 'gross', label: 'Gross sales', swatch: <span className="h-[2px] w-4 rounded-full bg-accent-fg" /> },
          { key: 'payout', label: 'Payout after fees', swatch: <span className="w-4 border-t-2 border-dashed border-muted" /> },
        ]
      : channels.map((ch) => ({ key: ch, label: channelLabels[ch], swatch: <span className={`h-2.5 w-2.5 rounded-full ${CHANNEL_DOT[ch]}`} /> }));

  return (
    <Card
      icon={TrendingUp}
      title="Sales over time"
      className="flex h-full flex-col"
      actions={
        <>
          <Tabs items={granularityItems} value={granularity} onChange={(k) => setGranularity(k as FinancialGranularity)} />
          <span className="h-5 w-px bg-line" aria-hidden />
          <Tabs items={modeItems} value={mode} onChange={(k) => setMode(k as ChartMode)} />
        </>
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
        {legend.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5">
            <span aria-hidden className="flex items-center">{l.swatch}</span>
            {l.label}
          </span>
        ))}
        <span className="ml-auto text-faint">
          {points.length} {unit}, days without sales included
        </span>
      </div>
      <div className="min-h-[280px] flex-1" role="img" aria-label="Sales over time chart; the ledger below lists every order">
        {points.length === 0 ? (
          <div className="grid h-full place-items-center text-[13px] text-muted">No sales in this period for the chosen channels.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {mode === 'stacked' ? (
              <BarChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
                {grid}
                <XAxis {...axisProps.x} />
                <YAxis {...axisProps.y} />
                {tooltip}
                {channels.map((ch, i) => (
                  <Bar
                    key={ch}
                    dataKey={ch}
                    stackId="sales"
                    fill={c[CHANNEL_VAR[ch]]}
                    stroke={c.pop}
                    strokeWidth={1}
                    maxBarSize={24}
                    radius={i === channels.length - 1 ? [4, 4, 0, 0] : 0}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            ) : mode === 'payout' ? (
              <AreaChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                {grid}
                <XAxis {...axisProps.x} />
                <YAxis {...axisProps.y} />
                {tooltip}
                <Area
                  type="linear"
                  dataKey="total"
                  stroke={c['accent-fg']}
                  strokeWidth={2}
                  fill={c['accent-fg']}
                  fillOpacity={0.1}
                  activeDot={{ r: 4.5, fill: c['accent-fg'], stroke: c.pop, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Area
                  type="linear"
                  dataKey="totalClean"
                  stroke={c.muted}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  fill="transparent"
                  activeDot={{ r: 4, fill: c.muted, stroke: c.pop, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                {grid}
                <XAxis {...axisProps.x} />
                <YAxis {...axisProps.y} />
                {tooltip}
                {channels.map((ch) => (
                  <Line
                    key={ch}
                    type="linear"
                    dataKey={ch}
                    stroke={c[CHANNEL_VAR[ch]]}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={false}
                    activeDot={{ r: 4.5, fill: c[CHANNEL_VAR[ch]], stroke: c.pop, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
