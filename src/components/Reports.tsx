import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, UploadCloud, FileText, Settings, Download, RotateCw } from 'lucide-react';

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
  original_name?: string;
  mime?: string;
  created_at?: string;
}

const fieldClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50';
const secondaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50';
const primaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300';
const iconButtonClassName =
  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600';

const getDisplayTitle = (file: Pick<ReportFile, 'title' | 'original_name' | 'date'>) => {
  return file.title || file.original_name || file.date || '报告文件';
};

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
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [preview, setPreview] = useState<ReportFile | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingFile, setEditingFile] = useState<ReportFile | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editTypeId, setEditTypeId] = useState('');

  const hasOverlay = showUploadSheet || showTypeModal || !!editingFile || !!preview;

  useEffect(() => {
    if (!hasOverlay) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [hasOverlay]);

  const loadTypes = useCallback(async () => {
    const res = await fetch('/api/report-types');
    if (res.ok) {
      const data = (await res.json()) as ReportType[];
      setTypes(data);
      setSelectedTypeId((current) =>
        current === 'all' || data.some((type) => type.id === current) ? current : 'all'
      );
      setUploadTypeId((current) => {
        if (data.length === 0) return '';
        return data.some((type) => type.id === current) ? current : data[0].id;
      });
      setEditTypeId((current) => {
        if (data.length === 0) return '';
        if (!current) return data[0].id;
        return data.some((type) => type.id === current) ? current : data[0].id;
      });
      setEditingTypeId((current) =>
        current && !data.some((type) => type.id === current) ? null : current
      );
      if (data.length === 0) {
        setShowUploadSheet(false);
      }
    }
  }, []);

  const loadFiles = useCallback(async () => {
    const res = await fetch('/api/report-files');
    if (res.ok) {
      const data = (await res.json()) as ReportFile[];
      setFiles(data);
      setPreview((current) => (current ? data.find((file) => file.id === current.id) ?? null : current));
      setEditingFile((current) => (current ? data.find((file) => file.id === current.id) ?? null : current));
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadTypes(), loadFiles()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadFiles, loadTypes]);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  const groupedFiles = useMemo(() => {
    const map = new Map<string, ReportFile[]>();
    types.forEach((type) => map.set(type.id, []));
    files.forEach((file) => {
      if (map.has(file.type_id)) {
        map.get(file.type_id)!.push(file);
      }
    });
    if (selectedTypeId === 'all') {
      return types.map((type) => ({ type, items: map.get(type.id) || [] }));
    }
    const type = types.find((item) => item.id === selectedTypeId);
    return type ? [{ type, items: map.get(type.id) || [] }] : [];
  }, [files, types, selectedTypeId]);

  const visibleGroups = useMemo(() => {
    if (selectedTypeId === 'all') {
      return groupedFiles.filter((group) => group.items.length > 0);
    }
    return groupedFiles;
  }, [groupedFiles, selectedTypeId]);

  const visibleFileCount = useMemo(() => {
    return visibleGroups.reduce((count, group) => count + group.items.length, 0);
  }, [visibleGroups]);

  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    types.forEach((type) => map.set(type.id, 0));
    files.forEach((file) => {
      map.set(file.type_id, (map.get(file.type_id) || 0) + 1);
    });
    return map;
  }, [files, types]);

  const hasTypes = types.length > 0;
  const selectedType = selectedTypeId === 'all' ? null : types.find((type) => type.id === selectedTypeId) || null;
  const uploadTypeName = types.find((type) => type.id === uploadTypeId)?.name || '未选择类型';
  const uploadTypeCount = uploadTypeId ? typeCounts.get(uploadTypeId) || 0 : 0;

  const closeTypeModal = () => {
    setShowTypeModal(false);
    setEditingTypeId(null);
    setEditingTypeName('');
    setTypeError(null);
  };

  const openUploadFlow = () => {
    if (!hasTypes) {
      setShowTypeModal(true);
      return;
    }
    setUploadError(null);
    setShowUploadSheet(true);
  };

  const handleAddType = async () => {
    const name = newTypeName.trim();
    if (!name) {
      setTypeError('请输入类型名称');
      return;
    }
    setTypeError(null);
    const res = await fetch('/api/report-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      setNewTypeName('');
      await loadTypes();
      return;
    }
    setTypeError('新增类型失败');
  };

  const handleUpdateType = async (id: string) => {
    const name = editingTypeName.trim();
    if (!name) {
      setTypeError('请输入类型名称');
      return;
    }
    setTypeError(null);
    const res = await fetch(`/api/report-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      setEditingTypeId(null);
      setEditingTypeName('');
      await loadTypes();
      return;
    }
    setTypeError('更新类型失败');
  };

  const handleDeleteType = async (id: string) => {
    if (!window.confirm('确定要删除该类型吗？')) return;
    setTypeError(null);
    const res = await fetch(`/api/report-types/${id}`, { method: 'DELETE' });
    if (res.status === 409) {
      setTypeError('该类型下仍有报告文件，无法删除');
      return;
    }
    if (res.ok) {
      if (selectedTypeId === id) setSelectedTypeId('all');
      await loadTypes();
      await loadFiles();
      return;
    }
    setTypeError('删除类型失败');
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadFiles();
      setShowUploadSheet(false);
    } catch {
      setUploadError('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!window.confirm('确定要删除该报告文件吗？')) return;
    const res = await fetch(`/api/report-files/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadFiles();
    }
  };

  const openEditFile = (file: ReportFile) => {
    setPreview(null);
    setEditingFile(file);
    setEditDate(file.date || '');
    setEditTitle(file.title || file.original_name || '');
    setEditTypeId(file.type_id);
  };

  const handleSaveEdit = async () => {
    if (!editingFile) return;
    await fetch(`/api/report-files/${editingFile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typeId: editTypeId, date: editDate, title: editTitle })
    });
    setEditingFile(null);
    await loadFiles();
  };

  const renderUploadFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">类型</label>
          <select
            className={fieldClassName}
            value={uploadTypeId}
            onChange={(e) => setUploadTypeId(e.target.value)}
          >
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">日期</label>
          <input
            type="date"
            className={fieldClassName}
            value={uploadDate}
            onChange={(e) => setUploadDate(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">标题（可选）</label>
        <input
          className={fieldClassName}
          placeholder="如：2026 年 3 月体检报告"
          value={uploadTitle}
          onChange={(e) => setUploadTitle(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">文件</label>
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-blue-200 bg-blue-50/70 px-4 py-6 text-center transition hover:bg-blue-50">
          <UploadCloud size={24} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-700">选择图片或 PDF 文件</span>
          <span className="text-xs text-blue-600/80">支持体检单、化验单等报告图片与 PDF</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </label>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 break-all">
          {uploadFile?.name || '未选择文件'}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl min-w-0 space-y-4 overflow-x-hidden md:space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 md:text-xl">上传报告</h2>
            <p className="mt-1 text-sm text-slate-500">本地保存图片与 PDF，手机上可全屏上传和预览。</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className={iconButtonClassName}
              onClick={handleRefresh}
              disabled={refreshing}
              title="刷新报告"
            >
              <RotateCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button className={`${secondaryButtonClassName} shrink-0 px-3 py-2`} onClick={() => setShowTypeModal(true)}>
              <Settings size={16} />
              管理类型
            </button>
          </div>
        </div>

        {!hasTypes ? (
          <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center md:px-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
              <Settings size={22} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">先创建报告类型</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">上传前需要先建立报告分类，例如血常规、肝功能、影像检查。</p>
            <button className={`${primaryButtonClassName} mt-5 w-full sm:w-auto`} onClick={() => setShowTypeModal(true)}>
              <Plus size={18} />
              去创建类型
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:hidden">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <div className="text-xs text-slate-500">默认上传类型</div>
                  <div className="mt-1 text-sm font-medium text-slate-900 break-words">{uploadTypeName}</div>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <div className="text-xs text-slate-500">当前类型文件数</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{uploadTypeCount} 份</div>
                </div>
              </div>
              <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm break-all">
                {uploadFile?.name || '支持直接上传图片与 PDF'}
              </div>
              <button className={`${primaryButtonClassName} mt-4 w-full`} onClick={openUploadFlow}>
                <UploadCloud size={18} />
                上传新报告
              </button>
            </div>

            <div className="mt-5 hidden md:block">
              {renderUploadFields()}
              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-h-6 flex-1">
                  {uploadError ? (
                    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {uploadError}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">默认上传到“{uploadTypeName}”，上传成功后列表会立即刷新。</div>
                  )}
                </div>
                <button className={`${primaryButtonClassName} shrink-0`} onClick={handleUpload} disabled={uploading}>
                  <UploadCloud size={18} />
                  {uploading ? '上传中...' : '上传报告'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 md:text-xl">报告列表</h2>
            <p className="mt-1 text-sm text-slate-500">点击预览区查看原始报告，底部操作区统一处理编辑、下载和删除。</p>
          </div>
          <button className={`${secondaryButtonClassName} shrink-0 px-3 py-2 md:hidden`} onClick={openUploadFlow}>
            <UploadCloud size={16} />
            上传
          </button>
        </div>

        {hasTypes && (
          <div className="-mx-1 mt-4 overflow-x-auto pb-1">
            <div className="inline-flex min-w-full gap-2 px-1">
              <button
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  selectedTypeId === 'all'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => setSelectedTypeId('all')}
              >
                <span>全部</span>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-slate-500">{files.length}</span>
              </button>
              {types.map((type) => (
                <button
                  key={type.id}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                    selectedTypeId === type.id
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={() => setSelectedTypeId(type.id)}
                >
                  <span>{type.name}</span>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-slate-500">{typeCounts.get(type.id) || 0}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!hasTypes ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center md:px-6">
            <div className="text-base font-semibold text-slate-900">还没有任何报告类型</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">先创建类型，再按类型筛选和归档报告文件。</p>
            <button className={`${secondaryButtonClassName} mt-5`} onClick={() => setShowTypeModal(true)}>
              <Settings size={16} />
              管理类型
            </button>
          </div>
        ) : visibleFileCount === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center md:px-6">
            <div className="text-base font-semibold text-slate-900">
              {files.length === 0 ? '还没有上传任何报告' : `${selectedType?.name || '当前类型'}下暂无报告`}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {files.length === 0
                ? '上传后可在这里按类型查看、预览和管理所有报告文件。'
                : '切换到其他类型，或继续上传新的报告文件。'}
            </p>
            <button className={`${primaryButtonClassName} mt-5 w-full sm:w-auto`} onClick={openUploadFlow}>
              <UploadCloud size={18} />
              {files.length === 0 ? '上传首份报告' : '继续上传'}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {visibleGroups.map(({ type, items }) => (
              <section key={type.id} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-700 md:text-base">{type.name}</h3>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                    {items.length} 份
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((file) => {
                    const isPdf = file.mime?.includes('pdf');
                    const url = `/api/report-files/${file.id}`;
                    const title = getDisplayTitle(file);

                    return (
                      <article key={file.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
                        <button className="block w-full text-left" onClick={() => setPreview(file)}>
                          <div className="relative h-48 bg-slate-200 sm:h-56 md:h-52">
                            {isPdf ? (
                              <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-900 px-4 text-white">
                                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10">
                                  <FileText size={30} />
                                </div>
                                <div className="text-sm font-medium">PDF 报告</div>
                                <div className="text-xs text-white/70">点击全屏预览</div>
                              </div>
                            ) : (
                              <img src={url} alt={title} className="h-full w-full object-cover" />
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4">
                              <div className="flex flex-wrap gap-2 text-xs text-white/80">
                                <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">{file.typeName || type.name}</span>
                                <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">{file.date || '未填写日期'}</span>
                              </div>
                              <div className="mt-2 text-base font-semibold text-white break-words">{title}</div>
                            </div>
                          </div>
                        </button>

                        <div className="space-y-3 p-4">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 break-words">{title}</div>
                            {file.original_name && file.original_name !== title && (
                              <div className="mt-1 text-xs text-slate-500 break-all">原文件：{file.original_name}</div>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button className={`${secondaryButtonClassName} h-11 px-3`} onClick={() => openEditFile(file)}>
                              <Edit2 size={16} />
                              编辑
                            </button>
                            <a
                              className={`${secondaryButtonClassName} h-11 px-3`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Download size={16} />
                              下载
                            </a>
                            <button
                              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                              onClick={() => handleDeleteFile(file.id)}
                            >
                              <Trash2 size={16} />
                              删除
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {showUploadSheet && (
        <div className="fixed inset-0 z-50 bg-black/70 md:flex md:items-center md:justify-center md:p-4" onClick={() => setShowUploadSheet(false)}>
          <div
            className="flex h-[100dvh] flex-col overflow-hidden bg-white md:h-auto md:max-h-[90vh] md:w-full md:max-w-xl md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">上传报告</h3>
                <p className="mt-1 text-sm text-slate-500">字段纵向排列，更适合手机单手操作。</p>
              </div>
              <button className={iconButtonClassName} onClick={() => setShowUploadSheet(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
              {renderUploadFields()}
            </div>
            <div className="border-t border-slate-200 bg-white/95 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur md:px-6 md:pb-6">
              <div className="space-y-3">
                {uploadError ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{uploadError}</div>
                ) : (
                  <div className="text-sm text-slate-500">将上传到“{uploadTypeName}”，成功后自动返回列表。</div>
                )}
                <button className={`${primaryButtonClassName} w-full`} onClick={handleUpload} disabled={uploading}>
                  <UploadCloud size={18} />
                  {uploading ? '上传中...' : '确认上传'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 md:flex md:items-center md:justify-center md:p-4" onClick={() => setPreview(null)}>
          <div
            className="flex h-[100dvh] flex-col overflow-hidden bg-white md:h-auto md:max-h-[92vh] md:w-full md:max-w-5xl md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900 break-words">{getDisplayTitle(preview)}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{preview.typeName || types.find((type) => type.id === preview.type_id)?.name || '未分类'}</span>
                  <span>{preview.date || '未填写日期'}</span>
                </div>
              </div>
              <button className={iconButtonClassName} onClick={() => setPreview(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100">
              {preview.mime?.includes('pdf') ? (
                <iframe src={`/api/report-files/${preview.id}`} className="h-full min-h-[60vh] w-full bg-white" title="pdf-preview" />
              ) : (
                <div className="flex min-h-full items-center justify-center bg-slate-950 p-4 md:p-6">
                  <img
                    src={`/api/report-files/${preview.id}`}
                    alt={getDisplayTitle(preview)}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white/95 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur md:px-6 md:pb-6">
              <div className="grid grid-cols-3 gap-2">
                <button className={`${secondaryButtonClassName} h-11 px-3`} onClick={() => openEditFile(preview)}>
                  <Edit2 size={16} />
                  编辑
                </button>
                <a
                  className={`${secondaryButtonClassName} h-11 px-3`}
                  href={`/api/report-files/${preview.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={16} />
                  下载
                </a>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  onClick={() => handleDeleteFile(preview.id)}
                >
                  <Trash2 size={16} />
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTypeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 md:flex md:items-center md:justify-center md:p-4" onClick={closeTypeModal}>
          <div
            className="flex h-[100dvh] flex-col overflow-hidden bg-white md:h-auto md:max-h-[90vh] md:w-full md:max-w-xl md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">报告类型管理</h3>
                <p className="mt-1 text-sm text-slate-500">新增、重命名或删除上传分类。</p>
              </div>
              <button className={iconButtonClassName} onClick={closeTypeModal}>
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
              {typeError && (
                <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{typeError}</div>
              )}

              {types.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <div className="text-base font-semibold text-slate-900">还没有报告类型</div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">先新增一个类型，上传时才能进行归类。</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {types.map((type) => (
                    <div key={type.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                      {editingTypeId === type.id ? (
                        <div className="space-y-3">
                          <input
                            className={fieldClassName}
                            value={editingTypeName}
                            onChange={(e) => setEditingTypeName(e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <button className={`${primaryButtonClassName} h-11 px-3`} onClick={() => handleUpdateType(type.id)}>
                              <Check size={16} />
                              保存
                            </button>
                            <button
                              className={`${secondaryButtonClassName} h-11 px-3`}
                              onClick={() => {
                                setEditingTypeId(null);
                                setEditingTypeName('');
                                setTypeError(null);
                              }}
                            >
                              <X size={16} />
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-slate-900 break-words">{type.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{typeCounts.get(type.id) || 0} 份报告</div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              className={iconButtonClassName}
                              onClick={() => {
                                setEditingTypeId(type.id);
                                setEditingTypeName(type.name);
                                setTypeError(null);
                              }}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                              onClick={() => handleDeleteType(type.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white/95 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur md:px-6 md:pb-6">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">新增类型</label>
              <div className="flex items-center gap-2">
                <input
                  className={`${fieldClassName} min-w-0 flex-1`}
                  placeholder="新增类型，如：血常规"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                />
                <button className={`${primaryButtonClassName} shrink-0 px-4`} onClick={handleAddType}>
                  <Plus size={18} />
                  新增
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingFile && (
        <div className="fixed inset-0 z-50 bg-black/70 md:flex md:items-center md:justify-center md:p-4" onClick={() => setEditingFile(null)}>
          <div
            className="flex h-[100dvh] flex-col overflow-hidden bg-white md:h-auto md:max-h-[90vh] md:w-full md:max-w-lg md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">编辑报告</h3>
                <p className="mt-1 text-sm text-slate-500">保留原文件，只更新类型、日期和标题。</p>
              </div>
              <button className={iconButtonClassName} onClick={() => setEditingFile(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">当前文件</div>
                <div className="mt-1 text-sm font-medium text-slate-900 break-all">{editingFile.original_name || getDisplayTitle(editingFile)}</div>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">类型</label>
                  <select className={fieldClassName} value={editTypeId} onChange={(e) => setEditTypeId(e.target.value)}>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">日期</label>
                  <input
                    type="date"
                    className={fieldClassName}
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">标题</label>
                  <input className={fieldClassName} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white/95 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur md:px-6 md:pb-6">
              <div className="grid grid-cols-2 gap-3">
                <button className={`${secondaryButtonClassName} h-11 px-3`} onClick={() => setEditingFile(null)}>
                  取消
                </button>
                <button className={`${primaryButtonClassName} h-11 px-3`} onClick={handleSaveEdit}>
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
