import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, UploadCloud, FileText } from 'lucide-react';

interface ReportType {
  id: string;
  name: string;
  sort_order?: number;
  created_at?: string;
}

interface ReportFile {
  id: string;
  type_id: string;
  typeName?: string;
  date?: string;
  title?: string;
  mime?: string;
  created_at?: string;
}

export function Reports() {
  const [types, setTypes] = useState<ReportType[]>([]);
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('all');

  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [typeError, setTypeError] = useState<string | null>(null);

  const [uploadTypeId, setUploadTypeId] = useState('');
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [preview, setPreview] = useState<{ id: string; title?: string; mime?: string } | null>(null);

  const loadTypes = async () => {
    const res = await fetch('/api/report-types');
    if (res.ok) {
      const data = await res.json();
      setTypes(data);
      if (!uploadTypeId && data.length > 0) {
        setUploadTypeId(data[0].id);
      }
    }
  };

  const loadFiles = async () => {
    const res = await fetch('/api/report-files');
    if (res.ok) {
      const data = await res.json();
      setFiles(data);
    }
  };

  useEffect(() => {
    loadTypes();
    loadFiles();
  }, []);

  const groupedFiles = useMemo(() => {
    const map = new Map<string, ReportFile[]>();
    types.forEach((t) => map.set(t.id, []));
    files.forEach((f) => {
      if (map.has(f.type_id)) {
        map.get(f.type_id)!.push(f);
      }
    });
    if (selectedTypeId === 'all') {
      return types.map((t) => ({ type: t, items: map.get(t.id) || [] }));
    }
    const type = types.find((t) => t.id === selectedTypeId);
    return type ? [{ type, items: map.get(type.id) || [] }] : [];
  }, [files, types, selectedTypeId]);

  const handleAddType = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    const res = await fetch('/api/report-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      setNewTypeName('');
      setTypeError(null);
      loadTypes();
    }
  };

  const handleUpdateType = async (id: string) => {
    const name = editingTypeName.trim();
    if (!name) return;
    const res = await fetch(`/api/report-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      setEditingTypeId(null);
      setEditingTypeName('');
      loadTypes();
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!window.confirm('确定要删除该类型吗？')) return;
    const res = await fetch(`/api/report-types/${id}`, { method: 'DELETE' });
    if (res.status === 409) {
      setTypeError('该类型下仍有报告文件，无法删除');
      return;
    }
    if (res.ok) {
      setTypeError(null);
      if (selectedTypeId === id) setSelectedTypeId('all');
      loadTypes();
      loadFiles();
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError('请选择文件');
      return;
    }
    if (!uploadTypeId) {
      setUploadError('请选择报告类型');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('typeId', uploadTypeId);
      form.append('date', uploadDate);
      if (uploadTitle) form.append('title', uploadTitle);
      const res = await fetch('/api/report-files', { method: 'POST', body: form });
      if (!res.ok) {
        setUploadError('上传失败');
        return;
      }
      setUploadFile(null);
      setUploadTitle('');
      await loadFiles();
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!window.confirm('确定要删除该报告文件吗？')) return;
    const res = await fetch(`/api/report-files/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadFiles();
    }
  };

  const renderPreview = () => {
    if (!preview) return null;
    const url = `/api/report-files/${preview.id}`;
    const isPdf = preview.mime?.includes('pdf');
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={() => setPreview(null)}
      >
        <div className="relative max-w-5xl w-full max-h-full bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <span className="font-medium text-slate-800 truncate">{preview.title || '报告预览'}</span>
            <button className="text-slate-500 hover:text-slate-700" onClick={() => setPreview(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="bg-slate-50">
            {isPdf ? (
              <iframe src={url} className="w-full h-[80vh]" title="pdf-preview" />
            ) : (
              <img src={url} alt="preview" className="w-full h-[80vh] object-contain" />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">报告类型管理</h2>
        {typeError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
            {typeError}
          </div>
        )}
        <div className="space-y-3">
          {types.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              {editingTypeId === t.id ? (
                <input
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200"
                  value={editingTypeName}
                  onChange={(e) => setEditingTypeName(e.target.value)}
                />
              ) : (
                <span className="flex-1 text-slate-700">{t.name}</span>
              )}
              {editingTypeId === t.id ? (
                <>
                  <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" onClick={() => handleUpdateType(t.id)}>
                    <Check size={18} />
                  </button>
                  <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" onClick={() => setEditingTypeId(null)}>
                    <X size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => { setEditingTypeId(t.id); setEditingTypeName(t.name); }}>
                    <Edit2 size={18} />
                  </button>
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg" onClick={() => handleDeleteType(t.id)}>
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <input
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200"
              placeholder="新增类型，如：血常规"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
            />
            <button className="px-3 py-2 bg-blue-600 text-white rounded-lg" onClick={handleAddType}>
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">上传报告</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">类型</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
              value={uploadTypeId}
              onChange={(e) => setUploadTypeId(e.target.value)}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">日期</label>
            <input
              type="date"
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
              value={uploadDate}
              onChange={(e) => setUploadDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">标题（可选）</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm text-slate-600 mb-1">文件</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full"
            />
          </div>
        </div>
        {uploadError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3">
            {uploadError}
          </div>
        )}
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
          onClick={handleUpload}
          disabled={uploading}
        >
          <UploadCloud size={18} />
          {uploading ? '上传中...' : '上传报告'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-slate-800">报告列表</h2>
          <div className="flex flex-wrap gap-2">
            <button
              className={`px-3 py-1.5 rounded-full text-sm border ${selectedTypeId === 'all' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-600 border-slate-200'}`}
              onClick={() => setSelectedTypeId('all')}
            >
              全部
            </button>
            {types.map((t) => (
              <button
                key={t.id}
                className={`px-3 py-1.5 rounded-full text-sm border ${selectedTypeId === t.id ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-600 border-slate-200'}`}
                onClick={() => setSelectedTypeId(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {groupedFiles.length === 0 && (
          <div className="text-slate-500 text-sm">暂无报告</div>
        )}

        <div className="space-y-6">
          {groupedFiles.map(({ type, items }) => (
            <div key={type.id}>
              <h3 className="font-medium text-slate-700 mb-3">{type.name}</h3>
              {items.length === 0 ? (
                <div className="text-sm text-slate-400">暂无文件</div>
              ) : (
                <div className="space-y-3">
                  {items.map((f) => {
                    const isPdf = f.mime?.includes('pdf');
                    const url = `/api/report-files/${f.id}`;
                    return (
                      <div key={f.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50">
                        {isPdf ? (
                          <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                            <FileText size={20} />
                          </div>
                        ) : (
                          <img src={url} alt={f.title || 'report'} className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{f.title || f.date || '报告文件'}</p>
                          <p className="text-xs text-slate-500">{f.date || '未填写日期'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 text-xs rounded-lg border border-slate-200 text-slate-600"
                            onClick={() => setPreview({ id: f.id, title: f.title, mime: f.mime })}
                          >
                            预览
                          </button>
                          <a
                            className="px-2 py-1 text-xs rounded-lg border border-slate-200 text-slate-600"
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            下载
                          </a>
                          <button
                            className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600"
                            onClick={() => handleDeleteFile(f.id)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {renderPreview()}
    </div>
  );
}
