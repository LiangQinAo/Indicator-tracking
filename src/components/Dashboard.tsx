import { useMemo } from 'react';
import { Indicator, MedicalRecord, EventMarker } from '../types';
import { format, parseISO } from 'date-fns';
import { AlertCircle, ArrowDown, ArrowRight, ArrowUp, CalendarDays, CheckCircle2 } from 'lucide-react';
import { PageRefreshButton } from './PageRefreshButton';

declare const __APP_VERSION__: string;

interface DashboardProps {
  records: MedicalRecord[];
  indicators: Indicator[];
  markers: EventMarker[];
  onRefresh: () => void | Promise<void>;
  isRefreshing: boolean;
}

type ChangeDirection = 'up' | 'down' | 'same';

interface LatestChangeItem {
  indicator: Indicator;
  latestValue: number;
  previousValue: number;
  delta: number;
  direction: ChangeDirection;
}

interface LatestValueItem {
  indicator: Indicator;
  value: number;
  abnormal: boolean;
}

const formatIndicatorRange = (indicator: Indicator) => {
  if (indicator.minNormal === undefined && indicator.maxNormal === undefined) return '未设置范围';
  if (indicator.minNormal === undefined) return `≤ ${indicator.maxNormal}`;
  if (indicator.maxNormal === undefined) return `≥ ${indicator.minNormal}`;
  return `${indicator.minNormal} - ${indicator.maxNormal}`;
};

const isIndicatorAbnormal = (indicator: Indicator, value: number) => {
  return (
    (indicator.minNormal !== undefined && value < indicator.minNormal) ||
    (indicator.maxNormal !== undefined && value > indicator.maxNormal)
  );
};

const getChangeDirection = (delta: number): ChangeDirection => {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'same';
};

const getChangeTone = (direction: ChangeDirection) => {
  switch (direction) {
    case 'up':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'down':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-500';
  }
};

const getChangeIcon = (direction: ChangeDirection) => {
  switch (direction) {
    case 'up':
      return ArrowUp;
    case 'down':
      return ArrowDown;
    default:
      return ArrowRight;
  }
};

export function Dashboard({ records, indicators, markers, onRefresh, isRefreshing }: DashboardProps) {
  const latestRecord = records[0];
  const previousRecord = records[1];

  const recentMarkers = useMemo(() => markers.slice(0, 5), [markers]);

  const visibleSummaryIndicators = useMemo(
    () => indicators.filter(i => i.isActive !== false && i.visibleInList !== false),
    [indicators]
  );

  const latestValueItems = useMemo(() => {
    if (!latestRecord) return [];

    return visibleSummaryIndicators
      .map(indicator => {
        const value = latestRecord.values[indicator.id];
        if (value === undefined) return null;
        return {
          indicator,
          value,
          abnormal: isIndicatorAbnormal(indicator, value),
        } satisfies LatestValueItem;
      })
      .filter((item): item is LatestValueItem => Boolean(item))
      .sort((a, b) => Number(b.abnormal) - Number(a.abnormal))
      .slice(0, 8);
  }, [latestRecord, visibleSummaryIndicators]);

  const abnormalItems = useMemo(() => {
    if (!latestRecord) return [];

    return visibleSummaryIndicators
      .map(indicator => {
        const value = latestRecord.values[indicator.id];
        if (value === undefined) return null;
        return isIndicatorAbnormal(indicator, value) ? { indicator, value } : null;
      })
      .filter(Boolean) as Array<{ indicator: Indicator; value: number }>;
  }, [latestRecord, visibleSummaryIndicators]);

  const latestChanges = useMemo(() => {
    if (!latestRecord || !previousRecord) return [];

    return visibleSummaryIndicators
      .map(indicator => {
        const latestValue = latestRecord.values[indicator.id];
        const previousValue = previousRecord.values[indicator.id];

        if (latestValue === undefined || previousValue === undefined) return null;

        const delta = Number((latestValue - previousValue).toFixed(2));
        return {
          indicator,
          latestValue,
          previousValue,
          delta,
          direction: getChangeDirection(delta),
        } satisfies LatestChangeItem;
      })
      .filter((item): item is LatestChangeItem => Boolean(item))
      .filter(item => item.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 4);
  }, [latestRecord, previousRecord, visibleSummaryIndicators]);

  const recentEventSummary = useMemo(() => {
    if (!markers.length) return '最近暂无事件标记';

    const grouped = new Map<string, EventMarker[]>();
    markers.forEach(marker => {
      const existing = grouped.get(marker.date) || [];
      existing.push(marker);
      grouped.set(marker.date, existing);
    });

    const [date, items] = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]))[0] || [];
    if (!date || !items?.length) return '最近暂无事件标记';
    if (items.length === 1) return `${date}：${items[0].title}`;
    return `${date}：${items[0].title} 等 ${items.length} 条事件`;
  }, [markers]);

  const recentMarkerCount = useMemo(() => {
    const windowStart = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return markers.filter(marker => new Date(marker.date).getTime() >= windowStart).length;
  }, [markers]);

  if (!records.length) {
    return (
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/70 p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                概览
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">最新检查与事件摘要</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                把关键检查结果、异常提醒和重要事件放在同一屏里，方便你在手机上快速回看。
              </p>
            </div>
            <div className="flex items-center gap-2 self-start">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                v{__APP_VERSION__}
              </span>
              <PageRefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
            </div>
          </div>

          <div className="mt-6 flex h-64 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-white/80 px-6 text-center shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-500">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">暂无数据</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">请先录入或上传化验单数据，概览页会自动汇总最近检查结果与事件时间点。</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/70 p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
              概览
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">最新检查与事件摘要</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              回到更直观的结果卡片视图，同时保留变化摘要和事件标记，手机上一眼就能看到重点。
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
              v{__APP_VERSION__}
            </span>
            <PageRefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
            <div className="text-sm text-slate-500">总记录数</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{records.length}</div>
            <div className="mt-1 text-xs text-slate-400">已按时间倒序整理</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
            <div className="text-sm text-slate-500">最近检查日期</div>
            <div className="mt-3 text-xl font-bold tracking-tight text-slate-900">{format(parseISO(latestRecord.date), 'yyyy-MM-dd')}</div>
            <div className="mt-1 text-xs text-slate-400">最新一条化验记录</div>
          </div>
          <div className="rounded-[24px] border border-rose-200 bg-rose-50/90 p-4 shadow-sm">
            <div className="text-sm text-rose-600">最近异常项</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-rose-600">{abnormalItems.length}</div>
            <div className="mt-1 text-xs text-rose-500">默认列表指标中的异常数量</div>
          </div>
          <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
            <div className="text-sm text-amber-700">近 14 天事件</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-amber-700">{recentMarkerCount}</div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-amber-600">{recentEventSummary}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[26px] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">最新检查结果</h3>
                <p className="mt-1 text-sm text-slate-500">延续原来更直观的结果卡片展示方式。</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                <CalendarDays size={14} />
                {format(parseISO(latestRecord.date), 'MM-dd')}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {latestValueItems.map(({ indicator, value, abnormal }) => (
                <div
                  key={indicator.id}
                  className={`rounded-2xl border px-4 py-4 shadow-sm transition ${
                    abnormal ? 'border-rose-200 bg-rose-50/90' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-700" title={indicator.name}>
                        {indicator.shortName || indicator.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">正常 {formatIndicatorRange(indicator)}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                        abnormal ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {abnormal ? '异常' : '正常'}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end gap-2">
                    <span className={`text-3xl font-bold tracking-tight ${abnormal ? 'text-rose-700' : 'text-slate-900'}`}>
                      {value}
                    </span>
                    <span className="pb-1 text-xs text-slate-400">{indicator.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[26px] border border-slate-200 bg-slate-950 p-4 text-white shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-semibold">最近事件标记</h3>
                <p className="mt-1 text-sm text-slate-300">把用药、发热、复查等背景和趋势一起看。</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                {markers.length} 条
              </span>
            </div>

            {recentMarkers.length ? (
              <div className="mt-4 space-y-3">
                {recentMarkers.map(marker => (
                  <div key={marker.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-white">{marker.title}</div>
                        {marker.notes ? (
                          <div className="mt-1 line-clamp-2 text-sm leading-6 text-slate-300">{marker.notes}</div>
                        ) : (
                          <div className="mt-1 text-sm text-slate-400">未填写备注</div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-200">
                        {marker.date}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center text-sm text-slate-300">
                暂无事件标记，可在录入页添加用药、感染、复查等时间点。
              </div>
            )}
          </section>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-semibold text-slate-900">异常项目摘要</h3>
            <p className="mt-1 text-sm text-slate-500">优先提醒最近一次检查中超出正常范围的指标。</p>
          </div>

          <div className="mt-4">
            {abnormalItems.length ? (
              <div className="flex flex-wrap gap-2">
                {abnormalItems.map(({ indicator, value }) => (
                  <div key={indicator.id} className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 shadow-sm">
                    <div className="font-medium text-rose-700">{indicator.shortName || indicator.name}</div>
                    <div className="mt-1 text-xs text-rose-600">
                      {value} {indicator.unit} · 正常 {formatIndicatorRange(indicator)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                <CheckCircle2 size={18} />
                最近一次记录中，默认列表指标均在正常范围内。
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-semibold text-slate-900">相较上次的主要变化</h3>
            <p className="mt-1 text-sm text-slate-500">按变化绝对值排序，优先展示最值得关注的波动。</p>
          </div>

          <div className="mt-4">
            {latestChanges.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {latestChanges.map(item => {
                  const Icon = getChangeIcon(item.direction);
                  return (
                    <div key={item.indicator.id} className={`rounded-2xl border px-4 py-4 shadow-sm ${getChangeTone(item.direction)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{item.indicator.shortName || item.indicator.name}</div>
                          <div className="mt-1 text-xs opacity-80">
                            {item.previousValue} → {item.latestValue} {item.indicator.unit}
                          </div>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">
                          <Icon size={14} />
                          {item.delta > 0 ? '+' : ''}
                          {item.delta}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                {previousRecord ? '与上一条记录相比，暂无可对比的明显数值变化。' : '只有一条记录，暂时无法与上次检查比较。'}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
