import React, { useState } from 'react';
import { Indicator, MedicalRecord } from '../types';
import { Edit2, Trash2, Check, X } from 'lucide-react';

interface RecordHistoryProps {
  records: MedicalRecord[];
  indicators: Indicator[];
  onUpdate: (record: MedicalRecord) => void;
  onDelete: (id: string) => void;
}

export function RecordHistory({ records, indicators, onUpdate, onDelete }: RecordHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MedicalRecord | null>(null);

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

  const sortedRecords = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const listIndicators = indicators.filter(i => i.isActive !== false && i.visibleInList !== false);

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
        <p className="text-slate-500">暂无历史记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 mb-6">历史记录</h2>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 whitespace-nowrap">日期</th>
                {listIndicators.map(ind => (
                  <th key={ind.id} className="px-3 py-3 whitespace-nowrap" title={ind.name}>
                    {ind.shortName || ind.name} 
                    <br />
                    <span className="text-xs text-slate-400 font-normal">({ind.minNormal + '-' +  ind.maxNormal})</span>
                  </th>
                ))}
                <th className="px-3 py-3 whitespace-nowrap">备注</th>
                <th className="px-3 py-3 whitespace-nowrap text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRecords.map(record => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap">
                    {editingId === record.id ? (
                      <input
                        type="date"
                        value={editForm?.date || ''}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, date: e.target.value } : null)}
                        className="px-1 py-1 border border-slate-200 rounded text-sm w-32"
                      />
                    ) : (
                      <span className=" text-slate-500">{record.date}</span>
                    )}
                  </td>
                  
                  {listIndicators.map(ind => (
                    <td key={ind.id} className="font-bold px-3 py-3 whitespace-nowrap">
                      {editingId === record.id ? (
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
                          className="px-2 py-1 border border-slate-200 rounded text-sm w-20"
                        />
                      ) : (
                        <span className="text-slate-600">
                          {record.values[ind.id] !== undefined ? record.values[ind.id] : '-'}
                        </span>
                      )}
                    </td>
                  ))}
                  
                  <td className="px-4 py-3">
                    {editingId === record.id ? (
                      <input
                        type="text"
                        value={editForm?.notes || ''}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, notes: e.target.value } : null)}
                        className="px-2 py-1 border border-slate-200 rounded text-sm w-full min-w-[120px]"
                        placeholder="备注..."
                      />
                    ) : (
                      <span className="text-slate-500 truncate max-w-[150px] inline-block" title={record.notes}>
                        {record.notes || '-'}
                      </span>
                    )}
                  </td>
                  
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {editingId === record.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={handleSave} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="保存">
                          <Check size={16} />
                        </button>
                        <button onClick={handleCancel} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors" title="取消">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(record)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="编辑">
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => onDelete(record.id)} 
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" 
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
