import { useMemo, useState } from 'react';
import { Indicator, MedicalRecord, EventMarker } from '../types';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import { PageRefreshButton } from './PageRefreshButton';

interface RecordHistoryProps {
  records: MedicalRecord[];
  indicators: Indicator[];
  markers: EventMarker[];
  onRefresh: () => void | Promise<void>;
  isRefreshing: boolean;
  onUpdate: (record: MedicalRecord) => void;
  onDelete: (id: string) => void;
}

type HistoryMode = 'default' | 'all-used';

const formatIndicatorRange = (indicator: Indicator) => {
  if (indicator.minNormal === undefined && indicator.maxNormal === undefined) return '未设置';
  if (indicator.minNormal === undefined) return `≤ ${indicator.maxNormal}`;
  if (indicator.maxNormal === undefined) return `≥ ${indicator.minNormal}`;
  return `${indicator.minNormal}-${indicator.maxNormal}`;
};

export function RecordHistory({ records, indicators, markers, onRefresh, isRefreshing, onUpdate, onDelete }: RecordHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MedicalRecord | null>(null);
  const [historyMode, setHistoryMode] = useState<HistoryMode>('default');

  const handleEdit = (record: MedicalRecord) => {
    setEditingId(record.id);
    setEditForm({ ...record, values: { ...record.values } });
  };

  const handleSave = () => {
    if (editForm) {
      onUpdate(editForm);
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [records]
  );

  const markersByDate = useMemo(() => {
    const grouped = new Map<string, EventMarker[]>();
    markers.forEach(marker => {
      const list = grouped.get(marker.date) || [];
      list.push(marker);
      grouped.set(marker.date, list);
    });
    return grouped;
  }, [markers]);

  const markerOnlyDates = useMemo(() => {
    const recordDates = new Set(records.map(record => record.date));
    return Array.from(markersByDate.keys())
      .filter(date => !recordDates.has(date))
      .sort((a, b) => b.localeCompare(a));
  }, [markersByDate, records]);

  const historyRows = useMemo(() => {
    const recordRows = sortedRecords.map(record => ({ type: 'record' as const, key: record.id, date: record.date, record }));
    const markerRows = markerOnlyDates.map(date => ({ type: 'marker-only' as const, key: `marker-only:${date}`, date }));
    return [...recordRows, ...markerRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [markerOnlyDates, sortedRecords]);

  const defaultIndicators = useMemo(
    () => indicators.filter(i => i.isActive !== false && i.visibleInList !== false),
    [indicators]
  );

  const allUsedIndicators = useMemo(() => {
    const usedIndicatorIds = new Set<string>();
    records.forEach(record => {
      Object.entries(record.values).forEach(([indicatorId, value]) => {
        if (value !== undefined && value !== null) {
          usedIndicatorIds.add(indicatorId);
        }
      });
    });

    return indicators.filter(indicator => usedIndicatorIds.has(indicator.id));
  }, [indicators, records]);

  const listIndicators = historyMode === 'all-used' ? allUsedIndicators : defaultIndicators;

  if (historyRows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">历史记录</h2>
            <p className="mt-1 text-sm text-slate-500">按时间查看指标明细与事件标记</p>
          </div>
          <PageRefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <p className="text-slate-500">暂无历史记录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 md:min-h-0 md:flex-1 md:overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">历史记录</h2>
          <p className="mt-1 text-sm text-slate-500">可切换默认列表列与所有已使用指标列</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center rounded-lg bg-slate-100 p-1 w-fit">
            <button
              onClick={() => setHistoryMode('default')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                historyMode === 'default' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              默认列表列
            </button>
            <button
              onClick={() => setHistoryMode('all-used')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                historyMode === 'all-used' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              所有已使用指标
            </button>
          </div>

          <PageRefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm md:min-h-0 md:flex-1">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-500 backdrop-blur">
          当前显示 {listIndicators.length} 个指标列。"所有已使用指标" 会包含历史记录中出现过数值的隐藏指标，但不会展开从未使用的停用字段。
        </div>

        <div className="flex-1 overflow-auto overscroll-contain pb-8 md:min-h-0 md:pb-0">
          <table className="w-full min-w-max border-separate border-spacing-0 text-left text-sm">
            <thead className="font-medium text-slate-600">
              <tr>
                <th className="sticky top-0 left-0 z-30 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 shadow-[0_1px_0_0_rgb(226_232_240),1px_0_0_0_rgb(226_232_240)] sm:px-3">
                  日期
                </th>
                {listIndicators.map(ind => (
                  <th
                    key={ind.id}
                    className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 shadow-[0_1px_0_0_rgb(226_232_240)] sm:px-3"
                    title={ind.name}
                  >
                    {ind.shortName || ind.name}
                    <br />
                    <span className="text-xs font-normal text-slate-400">({formatIndicatorRange(ind)})</span>
                  </th>
                ))}
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 shadow-[0_1px_0_0_rgb(226_232_240)] sm:px-3">
                  备注
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-right shadow-[0_1px_0_0_rgb(226_232_240)] sm:px-3">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map(row => {
                const record = row.type === 'record' ? row.record : null;
                const sameDayMarkers = markersByDate.get(row.date) || [];

                return (
                  <tr key={row.key} className="group transition-colors hover:bg-slate-50">
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-2 py-3 shadow-[1px_0_0_0_rgb(241_245_249)] group-hover:bg-slate-50 sm:px-3">
                      {record && editingId === record.id ? (
                        <input
                          type="date"
                          value={editForm?.date || ''}
                          onChange={(e) => setEditForm(prev => (prev ? { ...prev, date: e.target.value } : null))}
                          className="w-32 rounded border border-slate-200 px-1 py-1 text-sm"
                        />
                      ) : (
                        <div className="space-y-2">
                          <span className="block whitespace-nowrap text-slate-500">{row.date}</span>
                          {sameDayMarkers.length > 0 && (
                            <div className="flex max-w-[12rem] flex-wrap gap-1">
                              {sameDayMarkers.map(marker => (
                                <span
                                  key={marker.id}
                                  className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                                  title={marker.notes ? `${marker.title}：${marker.notes}` : marker.title}
                                >
                                  {marker.title}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {listIndicators.map(ind => (
                      <td key={ind.id} className="whitespace-nowrap border-b border-slate-100 px-2 py-3 font-bold sm:px-3">
                        {record && editingId === record.id ? (
                          <input
                            type="number"
                            step="any"
                            value={editForm?.values[ind.id] !== undefined ? editForm.values[ind.id] : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditForm(prev => {
                                if (!prev) return null;
                                const newValues = { ...prev.values };
                                if (val === '') {
                                  delete newValues[ind.id];
                                } else {
                                  newValues[ind.id] = Number(val);
                                }
                                return { ...prev, values: newValues };
                              });
                            }}
                            className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                          />
                        ) : (
                          <span className="text-slate-600">{record && record.values[ind.id] !== undefined ? record.values[ind.id] : '-'}</span>
                        )}
                      </td>
                    ))}

                    <td className="min-w-[180px] border-b border-slate-100 px-3 py-3 sm:px-4">
                      {record && editingId === record.id ? (
                        <input
                          type="text"
                          value={editForm?.notes || ''}
                          onChange={(e) => setEditForm(prev => (prev ? { ...prev, notes: e.target.value } : null))}
                          className="w-full min-w-[160px] rounded border border-slate-200 px-2 py-1 text-sm"
                          placeholder="备注..."
                        />
                      ) : (
                        <div className="space-y-2">
                          <span className="inline-block max-w-[220px] truncate text-slate-500" title={record?.notes || sameDayMarkers.map(marker => marker.notes).filter(Boolean).join('；')}>
                            {record?.notes || sameDayMarkers.map(marker => marker.notes).filter(Boolean).join('；') || '-'}
                          </span>
                          {sameDayMarkers.length > 0 && (
                            <div className="flex flex-wrap gap-1 md:hidden">
                              {sameDayMarkers.map(marker => (
                                <span
                                  key={marker.id}
                                  className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                                  title={marker.notes ? `${marker.title}：${marker.notes}` : marker.title}
                                >
                                  {marker.title}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 text-right sm:px-4">
                      {record && editingId === record.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={handleSave} className="rounded p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50" title="保存">
                            <Check size={16} />
                          </button>
                          <button onClick={handleCancel} className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100" title="取消">
                            <X size={16} />
                          </button>
                        </div>
                      ) : record ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEdit(record)} className="rounded p-1.5 text-blue-600 transition-colors hover:bg-blue-50" title="编辑">
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => onDelete(record.id)}
                            className="rounded p-1.5 text-red-500 transition-colors hover:bg-red-50"
                            title="删除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
