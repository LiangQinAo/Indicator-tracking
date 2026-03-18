import { useState } from 'react';
import { Indicator } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';

interface SettingsProps {
  indicators: Indicator[];
  onAdd: (indicator: Indicator) => void;
  onUpdate: (indicator: Indicator) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
}

export function Settings({ indicators, onAdd, onUpdate, onDelete, onReset }: SettingsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Indicator>>({});
  const [isAdding, setIsAdding] = useState(false);

  const handleEdit = (ind: Indicator) => {
    setEditingId(ind.id);
    setEditForm(ind);
  };

  const handleSaveEdit = () => {
    if (editForm.name && editForm.unit && editForm.id) {
      onUpdate(editForm as Indicator);
      setEditingId(null);
    }
  };

  const handleSaveNew = () => {
    if (editForm.name && editForm.unit) {
      onAdd({
        id: uuidv4(),
        name: editForm.name,
        unit: editForm.unit,
        minNormal: editForm.minNormal ? Number(editForm.minNormal) : undefined,
        maxNormal: editForm.maxNormal ? Number(editForm.maxNormal) : undefined,
        color: editForm.color || '#3b82f6',
      });
      setIsAdding(false);
      setEditForm({});
    }
  };

  const handleDelete = (id: string) => {
    onDelete(id);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800">自定义追踪指标</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm('确定要恢复默认指标吗？这将会覆盖您当前的指标设置。')) {
                  onReset();
                }
              }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium border border-slate-200"
            >
              恢复默认
            </button>
            <button
              onClick={() => {
                setIsAdding(true);
                setEditForm({ color: '#3b82f6' });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors"
            >
              <Plus size={18} />
              添加新指标
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {isAdding && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">指标名称</label>
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="如：骨髓原始细胞"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">简称 (默认显示)</label>
                  <input
                    type="text"
                    value={editForm.shortName || ''}
                    onChange={e => setEditForm({ ...editForm, shortName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="如：原始"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">单位</label>
                  <input
                    type="text"
                    value={editForm.unit || ''}
                    onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="如：%"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">正常范围 (最小值)</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.minNormal || ''}
                    onChange={e => setEditForm({ ...editForm, minNormal: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">正常范围 (最大值)</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.maxNormal || ''}
                    onChange={e => setEditForm({ ...editForm, maxNormal: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">图表颜色</label>
                  <input
                    type="color"
                    value={editForm.color || '#3b82f6'}
                    onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                    className="w-full h-10 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-4 col-span-1 sm:col-span-2 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isActive !== false}
                      onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-slate-700">启用该指标 (总开关)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.visibleInList !== false}
                      onChange={e => setEditForm({ ...editForm, visibleInList: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      disabled={editForm.isActive === false}
                    />
                    <span className={`text-sm ${editForm.isActive === false ? 'text-slate-400' : 'text-slate-700'}`}>显示在录入/列表</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.visibleInChart !== false}
                      onChange={e => setEditForm({ ...editForm, visibleInChart: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      disabled={editForm.isActive === false}
                    />
                    <span className={`text-sm ${editForm.isActive === false ? 'text-slate-400' : 'text-slate-700'}`}>显示在趋势图</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveNew}
                  className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          )}

          {indicators.map(ind => (
            <div key={ind.id} className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {editingId === ind.id ? (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-6 gap-2">
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="col-span-2 px-3 py-1.5 text-sm rounded-lg border border-slate-200"
                    placeholder="名称"
                  />
                  <input
                    type="text"
                    value={editForm.shortName || ''}
                    onChange={e => setEditForm({ ...editForm, shortName: e.target.value })}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-200"
                    placeholder="简称"
                  />
                  <input
                    type="text"
                    value={editForm.unit || ''}
                    onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-200"
                    placeholder="单位"
                  />
                  <input
                    type="number"
                    value={editForm.minNormal || ''}
                    onChange={e => setEditForm({ ...editForm, minNormal: Number(e.target.value) })}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-200"
                    placeholder="最小值"
                  />
                  <input
                    type="number"
                    value={editForm.maxNormal || ''}
                    onChange={e => setEditForm({ ...editForm, maxNormal: Number(e.target.value) })}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-200"
                    placeholder="最大值"
                  />
                  <div className="col-span-1 sm:col-span-6 flex items-center gap-4 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.isActive !== false}
                        onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-slate-700">启用</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.visibleInList !== false}
                        onChange={e => setEditForm({ ...editForm, visibleInList: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        disabled={editForm.isActive === false}
                      />
                      <span className={`text-sm ${editForm.isActive === false ? 'text-slate-400' : 'text-slate-700'}`}>列表</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.visibleInChart !== false}
                        onChange={e => setEditForm({ ...editForm, visibleInChart: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        disabled={editForm.isActive === false}
                      />
                      <span className={`text-sm ${editForm.isActive === false ? 'text-slate-400' : 'text-slate-700'}`}>图表</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ind.color }} />
                    <h3 className="font-medium text-slate-800 truncate" title={ind.name}>
                      {ind.shortName ? `${ind.shortName} (${ind.name})` : ind.name}
                    </h3>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0 max-w-[6rem] truncate" title={ind.unit}>{ind.unit}</span>
                    
                    <div className="flex items-center gap-2 ml-2">
                      <button 
                        onClick={() => onUpdate({ ...ind, isActive: ind.isActive === false ? true : false })}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${ind.isActive !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                        title="点击切换总开关"
                      >
                        总开关 {ind.isActive !== false ? '开' : '关'}
                      </button>
                      <button 
                        onClick={() => onUpdate({ ...ind, visibleInList: ind.visibleInList === false ? true : false })}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${ind.visibleInList !== false ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                        title="点击切换列表显示状态"
                        disabled={ind.isActive === false}
                        style={{ opacity: ind.isActive === false ? 0.5 : 1 }}
                      >
                        列表 {ind.visibleInList !== false ? '开' : '关'}
                      </button>
                      <button 
                        onClick={() => onUpdate({ ...ind, visibleInChart: ind.visibleInChart === false ? true : false })}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${ind.visibleInChart !== false ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                        title="点击切换图表显示状态"
                        disabled={ind.isActive === false}
                        style={{ opacity: ind.isActive === false ? 0.5 : 1 }}
                      >
                        图表 {ind.visibleInChart !== false ? '开' : '关'}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    正常范围: {ind.minNormal !== undefined ? ind.minNormal : '无'} - {ind.maxNormal !== undefined ? ind.maxNormal : '无'}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 shrink-0">
                {editingId === ind.id ? (
                  <>
                    <button onClick={handleSaveEdit} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                      <Check size={18} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                      <X size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleEdit(ind)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(ind.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
