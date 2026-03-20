import { useState, useMemo, useEffect } from 'react';
import { Indicator, MedicalRecord, EventMarker } from '../types';
import { format, parseISO, subWeeks, subMonths, subYears } from 'date-fns';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Customized,
} from 'recharts';
import { CalendarDays } from 'lucide-react';
import { PageRefreshButton } from './PageRefreshButton';

interface ChartsProps {
  records: MedicalRecord[];
  indicators: Indicator[];
  markers: EventMarker[];
  onRefresh: () => void | Promise<void>;
  isRefreshing: boolean;
}

type TimeRange = 'all' | '7w' | '1m' | '3m' | '6m' | '1y' | 'custom';

type ChartPoint = {
  date: string;
  fullDate: string;
  [key: string]: string | number | undefined;
};

type MarkerGroup = {
  date: string;
  items: EventMarker[];
  compactLabel: string;
};

function EventMarkerOverlay(props: any) {
  const { markerGroups, isMobile } = props;
  const xAxisMap = props?.xAxisMap;
  const offset = props?.offset;

  const xAxis = xAxisMap ? Object.values(xAxisMap)[0] as any : null;
  if (!xAxis || !offset || !markerGroups?.length) return null;

  const axisLabelY = offset.top + offset.height + (isMobile ? 22 : 26);
  const tickY = offset.top + offset.height + 4;

  return (
    <g>
      {markerGroups.map((group: MarkerGroup, index: number) => {
        const x = xAxis.scale?.(group.date);
        if (typeof x !== 'number' || Number.isNaN(x)) return null;

        const label = isMobile
          ? group.items.length > 1
            ? `${group.items[0].title}+${group.items.length - 1}`
            : group.items[0].title
          : group.items.length > 1
            ? `${group.items[0].title} +${group.items.length - 1}`
            : group.items[0].title;

        const truncatedLabel = label.length > (isMobile ? 7 : 10) ? `${label.slice(0, isMobile ? 6 : 9)}…` : label;
        const labelY = axisLabelY + ((index % 2) * (isMobile ? 10 : 12));

        return (
          <g key={group.date} transform={`translate(${x}, 0)`}>
            <line y1={offset.top} y2={offset.top + offset.height} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} opacity={0.28} />
            <line y1={tickY - 8} y2={tickY - 2} stroke="#f59e0b" strokeWidth={1.25} opacity={0.85} />
            <circle cy={tickY - 9} r={2.5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
            <text
              y={labelY}
              textAnchor="middle"
              fill="#b45309"
              fontSize={isMobile ? 9 : 10}
              fontWeight={600}
            >
              {truncatedLabel}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function Charts({ records, indicators, markers, onRefresh, isRefreshing }: ChartsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7w');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [isMobile, setIsMobile] = useState(false);

  const chartIndicators = useMemo(
    () => indicators.filter(i => i.isActive !== false && i.visibleInChart !== false),
    [indicators]
  );

  const dateBounds = useMemo(() => {
    if (!records.length) return { min: '', max: '' };
    const dates = records.map(r => new Date(r.date).getTime());
    return {
      min: format(new Date(Math.min(...dates)), 'yyyy-MM-dd'),
      max: format(new Date(Math.max(...dates)), 'yyyy-MM-dd'),
    };
  }, [records]);

  useEffect(() => {
    if (dateBounds.min && dateBounds.max && !customDateRange.start) {
      setCustomDateRange({ start: dateBounds.min, end: dateBounds.max });
    }
  }, [dateBounds, customDateRange.start]);

  useEffect(() => {
    const updateMobile = () => setIsMobile(window.innerWidth < 640);
    updateMobile();
    window.addEventListener('resize', updateMobile);
    return () => window.removeEventListener('resize', updateMobile);
  }, []);

  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(() => {
    const priority = ['wbc'];
    const defaults = chartIndicators.filter(i => priority.includes(i.id)).map(i => i.id);
    return defaults.length > 0 ? defaults : chartIndicators.slice(0, 1).map(i => i.id);
  });

  useEffect(() => {
    setSelectedIndicators(prev => {
      const availableIds = new Set(chartIndicators.map(ind => ind.id));
      const next = prev.filter(id => availableIds.has(id));
      if (next.length > 0) return next;
      return chartIndicators.slice(0, 1).map(ind => ind.id);
    });
  }, [chartIndicators]);

  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate = new Date(0);
    let endDate = new Date();

    if (timeRange === 'custom') {
      startDate = customDateRange.start ? new Date(customDateRange.start) : new Date(0);
      endDate = customDateRange.end ? new Date(customDateRange.end) : new Date();
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (timeRange) {
        case '7w':
          startDate = subWeeks(now, 1);
          break;
        case '1m':
          startDate = subMonths(now, 1);
          break;
        case '3m':
          startDate = subMonths(now, 3);
          break;
        case '6m':
          startDate = subMonths(now, 6);
          break;
        case '1y':
          startDate = subYears(now, 1);
          break;
        case 'all':
          startDate = new Date(0);
          break;
      }
    }

    return { startDate, endDate };
  }, [timeRange, customDateRange]);

  const filteredRecords = useMemo(() => {
    return records
      .filter(record => {
        const d = new Date(record.date);
        return d >= dateRange.startDate && d <= dateRange.endDate;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [records, dateRange]);

  const filteredMarkers = useMemo(() => {
    return markers
      .filter(marker => {
        const d = new Date(marker.date);
        return d >= dateRange.startDate && d <= dateRange.endDate;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [markers, dateRange]);

  const filteredData = useMemo<ChartPoint[]>(() => {
    const pointsByDate = new Map<string, ChartPoint>();

    filteredRecords.forEach(record => {
      const fullDate = format(parseISO(record.date), 'yyyy-MM-dd');
      const point = pointsByDate.get(fullDate) || {
        date: format(parseISO(record.date), 'MM-dd'),
        fullDate,
      };

      indicators.forEach(indicator => {
        if (record.values[indicator.id] !== undefined) {
          point[indicator.id] = record.values[indicator.id];
        }
      });

      pointsByDate.set(fullDate, point);
    });

    filteredMarkers.forEach(marker => {
      if (!pointsByDate.has(marker.date)) {
        pointsByDate.set(marker.date, {
          date: format(parseISO(marker.date), 'MM-dd'),
          fullDate: marker.date,
        });
      }
    });

    return Array.from(pointsByDate.values()).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [filteredMarkers, filteredRecords, indicators]);

  const markerGroups = useMemo<MarkerGroup[]>(() => {
    const grouped = new Map<string, EventMarker[]>();

    filteredMarkers.forEach(marker => {
      const existing = grouped.get(marker.date) || [];
      existing.push(marker);
      grouped.set(marker.date, existing);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, items]) => ({
        date,
        items,
        compactLabel: items.length > 1 ? `${items[0].title} +${items.length - 1}` : items[0].title,
      }));
  }, [filteredMarkers]);

  const activeIndicators = indicators.filter(i => selectedIndicators.includes(i.id));

  const toggleIndicator = (id: string) => {
    setSelectedIndicators(prev => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter(i => i !== id) : prev;
      }
      return [...prev, id];
    });
  };

  if (!records.length) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">指标趋势图</h2>
              <p className="mt-1 text-sm text-slate-500">查看指标趋势与事件时间点</p>
            </div>
            <PageRefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
          </div>
          <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-500">暂无数据可供分析</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">指标趋势图</h2>
            <p className="mt-1 text-sm text-slate-500">支持结合事件标记查看当前时间范围内的变化</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <PageRefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />

            <div className="flex w-fit rounded-lg bg-slate-100 p-1">
              {[
                { id: '7w', label: '近7天' },
                { id: '1m', label: '近1月' },
                { id: '3m', label: '近3月' },
                { id: '6m', label: '近半年' },
                { id: 'all', label: '全部' },
                { id: 'custom', label: '自定义' },
              ].map(range => (
                <button
                  key={range.id}
                  onClick={() => setTimeRange(range.id as TimeRange)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    timeRange === range.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {timeRange === 'custom' && (
              <div className="flex items-center gap-2 text-sm bg-slate-50 p-1 rounded-lg border border-slate-200">
                <input
                  type="date"
                  value={customDateRange.start}
                  min={dateBounds.min}
                  max={customDateRange.end || dateBounds.max}
                  onChange={e => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-2 py-1 bg-transparent text-slate-700 outline-none"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={customDateRange.end}
                  min={customDateRange.start || dateBounds.min}
                  max={dateBounds.max}
                  onChange={e => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-2 py-1 bg-transparent text-slate-700 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {chartIndicators.map(ind => {
            const isSelected = selectedIndicators.includes(ind.id);
            return (
              <button
                key={ind.id}
                onClick={() => toggleIndicator(ind.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  isSelected ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                style={isSelected ? { borderColor: ind.color, color: ind.color, backgroundColor: `${ind.color}10` } : {}}
              >
                {ind.shortName || ind.name}({ind.minNormal + '-' + ind.maxNormal})
              </button>
            );
          })}
        </div>

        {markerGroups.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-medium">
              <CalendarDays size={16} />
              当前范围内的事件标记
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {markerGroups.map(group => (
                <span
                  key={group.date}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs text-amber-700"
                  title={group.items.map(item => `${item.title}${item.notes ? `：${item.notes}` : ''}`).join('；')}
                >
                  <span>{group.date}</span>
                  <span>{group.compactLabel}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {activeIndicators.length > 0 && (
          <div className="mt-8 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: markerGroups.length > 0 ? (isMobile ? 38 : 42) : 6 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="fullDate"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  dy={10}
                  tickFormatter={(value: string) => format(parseISO(value), 'MM-dd')}
                  minTickGap={isMobile ? 24 : 12}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#64748B', marginBottom: '4px' }}
                  formatter={(value: number, name: string, props: any) => {
                    const ind = activeIndicators.find(i => i.id === props.dataKey);
                    return [`${value} ${ind?.unit || ''}`, ind?.shortName || ind?.name || name];
                  }}
                  labelFormatter={(label, payload) => {
                    const fullDate = payload?.[0]?.payload?.fullDate || label;
                    const markerLabel = markerGroups.find(group => group.date === fullDate);
                    return markerLabel ? `${fullDate} · ${markerLabel.items.map(item => item.title).join(' / ')}` : fullDate;
                  }}
                />

                {markerGroups.map(group => (
                  <ReferenceLine
                    key={group.date}
                    x={group.date}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    opacity={0.3}
                  />
                ))}
                {markerGroups.length > 0 && <Customized component={<EventMarkerOverlay markerGroups={markerGroups} isMobile={isMobile} />} />}

                {activeIndicators.length === 1 && activeIndicators[0].minNormal !== undefined && (
                  <ReferenceLine y={activeIndicators[0].minNormal} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} />
                )}
                {activeIndicators.length === 1 && activeIndicators[0].maxNormal !== undefined && (
                  <ReferenceLine y={activeIndicators[0].maxNormal} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} />
                )}

                {activeIndicators.map(ind => (
                  <Line
                    key={ind.id}
                    type="monotone"
                    dataKey={ind.id}
                    name={ind.name}
                    stroke={ind.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: ind.color, strokeWidth: 1.5, stroke: '#fff' }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    animationDuration={1000}
                    label={(props: any) => {
                      const { x, y, stroke, value } = props;
                      if (value === undefined || value === null) return null;
                      return (
                        <text x={x} y={y} dy={-10} fill={stroke} fontSize={10} textAnchor="middle" fontWeight="500">
                          {value}
                        </text>
                      );
                    }}
                  />
                ))}
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
