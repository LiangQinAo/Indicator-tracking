import { useMemo } from 'react';
import { Indicator, MedicalRecord, EventMarker } from '../types';
import { format, parseISO } from 'date-fns';
import { AlertCircle, ArrowDown, ArrowRight, ArrowUp, CalendarDays, CheckCircle2, RefreshCw } from 'lucide-react';

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
      return 'text-rose-600 bg-rose-50 border-rose-100';
    case 'down':
      return 'text-blue-600 bg-blue-50 border-blue-100';
    default:
      return 'text-slate-500 bg-slate-50 border-slate-100';
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

  if (!records.length) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">概览</h2>
              <p className="mt-1 text-sm text-slate-500">快速查看记录概况与最近事件</p>
            </div>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? '刷新中...' : '刷新'}
            </button>
          </div>

          <div className="flex flex-col items-center justify-center h-56 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <AlertCircle className="text-blue-500" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">暂无数据</h3>
            <p className="mt-1 text-slate-500">请先录入或上传您的化验单数据。</p>
          </div>

          <div className="mt-4 text-right text-xs text-slate-400">当前版本：{__APP_VERSION__}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">概览</h2>
            <p className="mt-1 text-sm text-slate-500">汇总最近一次检查变化与事件标记</p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? '刷新中...' : '刷新'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">总记录数</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{records.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">最近检查日期</p>
            <p className="mt-2 text-lg font-bold text-slate-800">{format(parseISO(latestRecord.date), 'yyyy-MM-dd')}</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <p className="text-sm text-rose-600">最近异常项</p>
            <p className="mt-2 text-2xl font-bold text-rose-600">{abnormalItems.length}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-blue-600">最近事件</p>
            <p className="mt-2 line-clamp-2 text-sm font-medium text-blue-700">{recentEventSummary}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-100 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">最近一次检查摘要</h3>
                <p className="mt-1 text-sm text-slate-500">异常项目与上次相比变化最大的指标</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                <CalendarDays size={14} />
                {format(parseISO(latestRecord.date), 'MM-dd')}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">异常项目</p>
                {abnormalItems.length ? (
                  <div className="flex flex-wrap gap-2">
                    {abnormalItems.map(({ indicator, value }) => (
                      <div
                        key={indicator.id}
                        className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                      >
                        <div className="font-medium">{indicator.shortName || indicator.name}</div>
                        <div className="mt-1 text-xs text-rose-600">
                          {value} {indicator.unit} · 正常 {formatIndicatorRange(indicator)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                    <CheckCircle2 size={16} />
                    最近一次记录中，默认列表指标均在正常范围内。
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">相较上次的主要变化</p>
                {latestChanges.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {latestChanges.map(item => {
                      const Icon = getChangeIcon(item.direction);
                      return (
                        <div
                          key={item.indicator.id}
                          className={`rounded-xl border px-3 py-3 text-sm ${getChangeTone(item.direction)}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{item.indicator.shortName || item.indicator.name}</span>
                            <span className="inline-flex items-center gap-1 text-xs font-medium">
                              <Icon size={14} />
                              {item.delta > 0 ? '+' : ''}{item.delta}
                            </span>
                          </div>
                          <div className="mt-1 text-xs opacity-80">
                            {item.previousValue} → {item.latestValue} {item.indicator.unit}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                    {previousRecord ? '与上一条记录相比，暂无可对比的明显数值变化。' : '只有一条记录，暂时无法与上次检查比较。'}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 p-4 sm:p-5">
            <div className="mb-4">
              <h3 className="font-semibold text-slate-800">最近事件标记</h3>
              <p className="mt-1 text-sm text-slate-500">便于结合治疗、感染或用药时间点查看趋势</p>
            </div>

            {recentMarkers.length ? (
              <div className="space-y-3">
                {recentMarkers.map(marker => (
                  <div key={marker.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">{marker.title}</p>
                        {marker.notes ? (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{marker.notes}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-slate-500 border border-slate-200">
                        {marker.date}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                暂无事件标记，可在新增记录页补充用药、发热、复查等时间点。
              </div>
            )}
          </section>
        </div>

        <div className="mt-4 text-right text-xs text-slate-400">当前版本：{__APP_VERSION__}</div>
      </div>
    </div>
  );
}
