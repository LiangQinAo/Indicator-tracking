import { useState, useMemo, useEffect } from 'react';
import { Indicator, MedicalRecord } from '../types';
import { format, parseISO, subDays, subWeeks, subMonths, subYears, isAfter } from 'date-fns';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ChartsProps {
  records: MedicalRecord[];
  indicators: Indicator[];
}

type TimeRange = 'all' | '7w' | '1m' | '3m' | '6m' | '1y' | 'custom';

export function Charts({ records, indicators }: ChartsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7w');
  const [customDateRange, setCustomDateRange] = useState<{start: string, end: string}>({start: '', end: ''});
  
  const chartIndicators = useMemo(() => indicators.filter(i => i.isActive !== false && i.visibleInChart !== false), [indicators]);
  
  const dateBounds = useMemo(() => {
    if (!records.length) return { min: '', max: '' };
    const dates = records.map(r => new Date(r.date).getTime());
    return {
      min: format(new Date(Math.min(...dates)), 'yyyy-MM-dd'),
      max: format(new Date(Math.max(...dates)), 'yyyy-MM-dd')
    };
  }, [records]);

  useEffect(() => {
    if (dateBounds.min && dateBounds.max && !customDateRange.start) {
      setCustomDateRange({ start: dateBounds.min, end: dateBounds.max });
    }
  }, [dateBounds]);

  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(() => {
    // Default to the first 4 priority indicators if available, else just the first one
    // const priority = ['wbc', 'hgb', 'neut', 'plt'];
    const priority = ['wbc'];
    const defaults = chartIndicators.filter(i => priority.includes(i.id)).map(i => i.id);
    return defaults.length > 0 ? defaults : (chartIndicators[0] ? [chartIndicators[0].id] : []);
  });

  const filteredData = useMemo(() => {
    if (!records.length) return [];
    
    const now = new Date();
    let startDate = new Date(0);
    let endDate = new Date();

    if (timeRange === 'custom') {
      startDate = customDateRange.start ? new Date(customDateRange.start) : new Date(0);
      endDate = customDateRange.end ? new Date(customDateRange.end) : new Date();
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (timeRange) {
        case '7w': startDate = subWeeks(now, 1); break;
        case '1m': startDate = subMonths(now, 1); break;
        case '3m': startDate = subMonths(now, 3); break;
        case '6m': startDate = subMonths(now, 6); break;
        case '1y': startDate = subYears(now, 1); break;
        case 'all': startDate = new Date(0); break;
      }
    }

    const data = records
      .filter(r => {
        const d = new Date(r.date);
        return d >= startDate && d <= endDate;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(r => {
        const dataPoint: any = {
          date: format(parseISO(r.date), 'MM-dd'),
          fullDate: format(parseISO(r.date), 'yyyy-MM-dd'),
        };
        indicators.forEach(ind => {
          if (r.values[ind.id] !== undefined) {
            dataPoint[ind.id] = r.values[ind.id];
          }
        });
        return dataPoint;
      });

    return data;
  }, [records, timeRange, indicators, customDateRange]);

  const activeIndicators = indicators.filter(i => selectedIndicators.includes(i.id));

  const toggleIndicator = (id: string) => {
    setSelectedIndicators(prev => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter(i => i !== id) : prev; // Prevent deselecting all
      }
      return [...prev, id];
    });
  };

  if (!records.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl shadow-sm border border-slate-100">
        <p className="text-slate-500">暂无数据可供分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-800">指标趋势图</h2>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
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
                    timeRange === range.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
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
                  isSelected
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                style={isSelected ? { borderColor: ind.color, color: ind.color, backgroundColor: `${ind.color}10` } : {}}
              >
                {ind.shortName || ind.name}({ind.minNormal + '-' +  ind.maxNormal})
              </button>
            );
          })}
        </div>

        {activeIndicators.length > 0 && (
          <div className="h-80 w-full mt-8">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748B', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748B', fontSize: 12 }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#64748B', marginBottom: '4px' }}
                  formatter={(value: number, name: string, props: any) => {
                    const ind = activeIndicators.find(i => i.id === props.dataKey);
                    return [`${value} ${ind?.unit || ''}`, ind?.shortName || ind?.name || name];
                  }}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                />
                
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
