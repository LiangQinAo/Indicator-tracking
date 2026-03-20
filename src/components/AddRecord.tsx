import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EventMarker, Indicator, MedicalRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2, AlertCircle, X, FileText, Info, Trash2, RotateCw, Pencil } from 'lucide-react';

interface AddRecordProps {
  records: MedicalRecord[];
  indicators: Indicator[];
  markers: EventMarker[];
  onAdd: (record: MedicalRecord) => void;
  onUpdate: (record: MedicalRecord) => void;
  onAddIndicator: (indicator: Indicator) => void;
  onAddMarker: (marker: EventMarker) => void;
  onUpdateMarker: (marker: EventMarker) => void;
  onDeleteMarker: (id: string) => void;
}

interface AiJobResult {
  date: string;
  values: Record<string, number>;
  newIndicators?: Indicator[];
  mergeRecordId?: string;
}

interface AiJobConflict {
  recordId: string;
  diffs: { indicatorId: string; oldValue: number; newValue: number }[];
}

interface AiJob {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'conflict' | 'error' | 'saved' | 'ignored';
  date?: string;
  result?: AiJobResult | null;
  conflict?: AiJobConflict | null;
  error?: string | null;
  mime?: string | null;
  original_name?: string | null;
}

interface PendingFile {
  id: string;
  file: File;
  previewUrl?: string;
  isPdf: boolean;
}

export function AddRecord({
  records,
  indicators,
  markers,
  onAdd,
  onUpdate,
  onAddIndicator,
  onAddMarker,
  onUpdateMarker,
  onDeleteMarker,
}: AddRecordProps) {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [markerTitle, setMarkerTitle] = useState('');
  const [markerNotes, setMarkerNotes] = useState('');
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);

  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detailJob, setDetailJob] = useState<AiJob | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [savedExpanded, setSavedExpanded] = useState(false);
  const [jobsRefreshing, setJobsRefreshing] = useState(false);

  const listIndicators = indicators.filter(i => i.isActive !== false && i.visibleInList !== false);

  const latestMarker = useMemo(() => {
    const datedMarkers = markers.filter(marker => marker.date);
    return datedMarkers.sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }, [markers]);

  const sortedMarkers = useMemo(() => {
    return [...markers].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
    });
  }, [markers]);

  const sameDayMarkers = useMemo(() => {
    return sortedMarkers.filter(marker => marker.date === date);
  }, [date, sortedMarkers]);

  const resetMarkerForm = useCallback(() => {
    setMarkerTitle('');
    setMarkerNotes('');
    setEditingMarkerId(null);
  }, []);

  const loadMarkerIntoForm = useCallback((marker: EventMarker) => {
    setDate(marker.date);
    setMarkerTitle(marker.title);
    setMarkerNotes(marker.notes || '');
    setEditingMarkerId(marker.id);
    setUploadError(null);
  }, []);

  const loadJobs = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setJobsRefreshing(true);
    }
    try {
      const res = await fetch('/api/ai-jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } finally {
      if (showRefreshing) {
        setJobsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const timer = setInterval(loadJobs, 3000);
    return () => clearInterval(timer);
  }, [loadJobs]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    const parsedValues: Record<string, number> = {};
    Object.entries(values).forEach(([key, val]) => {
      if (val && !isNaN(Number(val))) {
        parsedValues[key] = Number(val);
      }
    });

    if (Object.keys(parsedValues).length === 0) {
      setUploadError('请至少输入一项有效指标');
      return;
    }

    onAdd({
      id: uuidv4(),
      date,
      values: parsedValues,
      notes,
    });

    setValues({});
    setNotes('');
  };

  const handleSaveMarker = () => {
    const title = markerTitle.trim();
    if (!title) {
      setUploadError('请输入事件标题');
      return;
    }

    setUploadError(null);

    const payload: EventMarker = {
      id: editingMarkerId || uuidv4(),
      date,
      title,
      notes: markerNotes.trim() || undefined,
    };

    if (editingMarkerId) {
      onUpdateMarker(payload);
    } else {
      onAddMarker(payload);
    }

    resetMarkerForm();
  };

  const handleDeleteMarker = (id: string) => {
    if (!window.confirm('确定要删除这个事件标记吗？')) return;
    onDeleteMarker(id);
    if (editingMarkerId === id) {
      resetMarkerForm();
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploadError(null);
    setMode('ai');

    const newItems = acceptedFiles.map(file => ({
      id: uuidv4(),
      file,
      previewUrl: file.type.includes('pdf') ? undefined : URL.createObjectURL(file),
      isPdf: file.type.includes('pdf'),
    }));
    setPendingFiles(prev => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'application/pdf': ['.pdf'] },
  } as any);

  const resolveJob = async (id: string, status: 'saved' | 'ignored') => {
    await fetch(`/api/ai-jobs/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadJobs();
  };

  const handleCancelJob = async (id: string) => {
    await fetch(`/api/ai-jobs/${id}`, { method: 'DELETE' });
    loadJobs();
  };

  const handleRetryJob = async (id: string) => {
    const res = await fetch(`/api/ai-jobs/${id}/retry`, { method: 'POST' });
    if (!res.ok) {
      setUploadError('重试失败，请稍后再试');
    }
    loadJobs();
  };

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => prev.filter(item => item.id !== id));
  };

  const submitPendingFiles = async () => {
    if (pendingFiles.length === 0) {
      setUploadError('请先选择文件');
      return;
    }
    setSubmitting(true);
    setUploadError(null);
    try {
      for (const item of pendingFiles) {
        const form = new FormData();
        form.append('file', item.file);
        const res = await fetch('/api/ai-jobs', { method: 'POST', body: form });
        if (!res.ok) {
          setUploadError('上传失败，请稍后再试');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      setPendingFiles([]);
      loadJobs();
    } finally {
      setSubmitting(false);
    }
  };

  const saveJobRecord = async (job: AiJob) => {
    if (!job.result) return;
    if (job.result.newIndicators && job.result.newIndicators.length > 0) {
      job.result.newIndicators.forEach(ind => onAddIndicator(ind));
    }
    if (job.result.mergeRecordId) {
      const existing = records.find(r => r.id === job.result?.mergeRecordId);
      if (existing) {
        const mergedValues = { ...existing.values, ...job.result.values };
        onUpdate({
          ...existing,
          date: job.result.date,
          values: mergedValues,
          notes: existing.notes,
        });
      } else {
        onAdd({
          id: uuidv4(),
          date: job.result.date,
          values: job.result.values,
          notes: 'AI 识别导入',
        });
      }
    } else {
      onAdd({
        id: uuidv4(),
        date: job.result.date,
        values: job.result.values,
        notes: 'AI 识别导入',
      });
    }
    await resolveJob(job.id, 'saved');
  };

  const isZeroItemsJob = (job: AiJob) => {
    return job.status === 'success' && (!job.result?.values || Object.keys(job.result.values).length === 0);
  };

  const handleBulkSave = async (savableJobs: AiJob[]) => {
    if (savableJobs.length === 0) return;
    setBulkSaving(true);
    setUploadError(null);
    try {
      for (const job of savableJobs) {
        try {
          await saveJobRecord(job);
          await new Promise(resolve => setTimeout(resolve, 120));
        } catch (e) {
          setUploadError('部分任务保存失败，请稍后重试');
        }
      }
    } finally {
      setBulkSaving(false);
      loadJobs();
    }
  };

  const indicatorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    indicators.forEach(i => map.set(i.id, i.shortName || i.name));
    if (detailJob?.result?.newIndicators) {
      detailJob.result.newIndicators.forEach(i => map.set(i.id, i.name));
    }
    return map;
  }, [indicators, detailJob]);

  const renderDetailModal = () => {
    if (!detailJob || !detailJob.result) return null;
    const valuesList = Object.entries(detailJob.result.values || {});
    const isPdf = detailJob.mime?.includes('pdf');
    const fileUrl = `/api/ai-jobs/${detailJob.id}/file`;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={() => setDetailJob(null)}
      >
        <div
          className="relative max-h-full w-full max-w-5xl overflow-hidden rounded-lg bg-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="font-medium text-slate-800">识别详情</span>
            <button className="text-slate-500 hover:text-slate-700" onClick={() => setDetailJob(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="max-h-[80vh] space-y-4 overflow-y-auto p-4">
            <div className="text-sm text-slate-600">日期：{detailJob.result.date}</div>

            <div className="rounded-lg bg-slate-50 p-3">
              {isPdf ? (
                <iframe src={fileUrl} className="h-[50vh] w-full" title="ai-preview" />
              ) : (
                <img src={fileUrl} alt="ai-preview" className="max-h-[50vh] w-full object-contain" />
              )}
            </div>

            <div>
              <h4 className="mb-2 font-medium text-slate-700">识别指标</h4>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {valuesList.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 p-2">
                    <span className="text-slate-600">{indicatorNameMap.get(key) || key}</span>
                    <span className="font-medium text-slate-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {detailJob.result.newIndicators && detailJob.result.newIndicators.length > 0 && (
              <div>
                <h4 className="mb-2 font-medium text-slate-700">新指标</h4>
                <div className="space-y-1 text-sm">
                  {detailJob.result.newIndicators.map(ind => (
                    <div key={ind.id} className="text-slate-600">{ind.name} ({ind.unit || '无单位'})</div>
                  ))}
                </div>
              </div>
            )}

            {detailJob.status === 'conflict' && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-red-600">
                  <AlertCircle size={16} />
                  <span className="font-medium">与已有记录冲突</span>
                </div>
                {detailJob.conflict?.diffs?.length ? (
                  <div className="space-y-1 text-sm">
                    {detailJob.conflict.diffs.map(diff => (
                      <div key={diff.indicatorId} className="flex items-center justify-between">
                        <span>{indicatorNameMap.get(diff.indicatorId) || diff.indicatorId}</span>
                        <span className="text-red-700">{diff.oldValue} → {diff.newValue}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-red-600">同日期已有记录，已取消合并。</div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white"
                    onClick={() => { handleCancelJob(detailJob.id); setDetailJob(null); }}
                  >
                    删除任务
                  </button>
                </div>
              </div>
            )}

            {detailJob.status !== 'conflict' && (
              <div className="flex flex-col gap-2">
                {detailJob.result.mergeRecordId && (
                  <div className="text-xs text-slate-500">将合并到同日期已有记录</div>
                )}
                <button
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white"
                  onClick={() => { saveJobRecord(detailJob); setDetailJob(null); }}
                >
                  {detailJob.result.mergeRecordId ? '合并保存' : '保存记录'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex w-full rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
            mode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          手动录入
        </button>
        <button
          onClick={() => setMode('ai')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
            mode === 'ai' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          AI 智能识别
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        {mode === 'ai' ? (
          <div className="space-y-6">
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <UploadCloud size={28} />
                </div>
                <div>
                  <p className="font-medium text-slate-700">点击或拖拽化验单图片 / PDF 至此</p>
                  <p className="mt-1 text-sm text-slate-500">识别任务将在后台处理，关闭页面也不会中断</p>
                </div>
              </div>
            </div>

            {pendingFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-700">待上传队列 ({pendingFiles.length})</h3>
                  <button
                    className="text-sm text-red-500 hover:text-red-600"
                    onClick={() => setPendingFiles([])}
                  >
                    清空
                  </button>
                </div>
                <div className="space-y-2">
                  {pendingFiles.map(item => (
                    <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      {item.isPdf ? (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                          <FileText size={18} />
                        </div>
                      ) : (
                        <img
                          src={item.previewUrl}
                          alt="preview"
                          className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200 object-cover"
                          onClick={() => setPreviewUrl(item.previewUrl || null)}
                        />
                      )}
                      <div className="min-w-0 flex-1 truncate text-sm text-slate-700">
                        {item.file.name}
                      </div>
                      <button
                        className="p-2 text-slate-400 hover:text-red-500"
                        onClick={() => removePendingFile(item.id)}
                        title="移除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  onClick={submitPendingFiles}
                  disabled={submitting}
                >
                  {submitting ? '提交中...' : '开始识别'}
                </button>
              </div>
            )}

            {uploadError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle size={16} />
                {uploadError}
              </div>
            )}

            <div className="space-y-3">
              {(() => {
                const savedJobs = jobs.filter(job => job.status === 'saved');
                const activeJobs = jobs.filter(job => job.status !== 'saved');
                const savableJobs = activeJobs.filter(job => job.status === 'success' && !isZeroItemsJob(job));

                return (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-700">识别任务</div>
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-blue-600 disabled:opacity-50"
                          disabled={jobsRefreshing}
                          onClick={() => loadJobs(true)}
                          title="刷新任务"
                          type="button"
                        >
                          <RotateCw size={16} className={jobsRefreshing ? 'animate-spin' : ''} />
                        </button>
                        <button
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                          disabled={bulkSaving || savableJobs.length === 0}
                          onClick={() => handleBulkSave(savableJobs)}
                        >
                          {bulkSaving ? '保存中...' : '全部保存'}
                        </button>
                      </div>
                    </div>

                    {activeJobs.length === 0 && (
                      <div className="text-sm text-slate-500">暂无识别任务</div>
                    )}

                    {activeJobs.map(job => {
                      const fileUrl = `/api/ai-jobs/${job.id}/file`;
                      const isPdf = job.mime?.includes('pdf');
                      const zeroItems = isZeroItemsJob(job);
                      const statusLabel = {
                        pending: '等待处理',
                        processing: '识别中',
                        success: zeroItems ? '异常/0项' : '可保存',
                        conflict: '冲突待处理',
                        error: '识别失败',
                        ignored: '已忽略',
                      }[job.status];
                      return (
                        <div key={job.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                          {isPdf ? (
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                              <FileText size={20} />
                            </div>
                          ) : (
                            <img
                              src={fileUrl}
                              alt="preview"
                              className="h-14 w-14 cursor-pointer rounded-lg border border-slate-200 object-cover"
                              onClick={() => setPreviewUrl(fileUrl)}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-800">{job.date || '待识别日期'}</span>
                              <span className={`rounded-full px-2 py-0.5 text-xs ${
                                job.status === 'conflict' ? 'bg-red-50 text-red-600' :
                                job.status === 'error' || zeroItems ? 'bg-rose-50 text-rose-600' :
                                job.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                job.status === 'processing' ? 'bg-blue-50 text-blue-600' :
                                'bg-slate-100 text-slate-500'
                              }`}>{statusLabel}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {zeroItems ? '识别到 0 项指标（异常）' : job.result?.values ? `识别 ${Object.keys(job.result.values).length} 项指标` : job.error || '等待处理...'}
                            </div>
                          </div>

                          {job.status === 'processing' && (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          )}

                          <div className="flex items-center gap-1">
                            {(job.status === 'error' || zeroItems) && (
                              <button
                                className="p-2 text-slate-400 hover:text-blue-600"
                                onClick={() => handleRetryJob(job.id)}
                                title="重试"
                              >
                                <RotateCw size={16} />
                              </button>
                            )}

                            {job.status === 'success' && !zeroItems && (
                              <button
                                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                                onClick={() => setDetailJob(job)}
                              >
                                <Info size={14} />
                                详情
                              </button>
                            )}

                            <button
                              className="p-2 text-slate-400 hover:text-red-500"
                              onClick={() => handleCancelJob(job.id)}
                              title={job.status === 'conflict' ? '删除冲突任务' : job.status === 'pending' || job.status === 'processing' ? '取消任务' : '删除任务'}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="border-t border-slate-100 pt-2">
                      <button
                        className="flex w-full items-center justify-between text-sm text-slate-600 hover:text-slate-800"
                        onClick={() => setSavedExpanded(prev => !prev)}
                      >
                        <span>已保存（{savedJobs.length}）</span>
                        <span>{savedExpanded ? '收起' : '展开'}</span>
                      </button>
                      {savedExpanded && savedJobs.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {savedJobs.map(job => {
                            const fileUrl = `/api/ai-jobs/${job.id}/file`;
                            const isPdf = job.mime?.includes('pdf');
                            return (
                              <div key={job.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
                                {isPdf ? (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                                    <FileText size={18} />
                                  </div>
                                ) : (
                                  <img
                                    src={fileUrl}
                                    alt="preview"
                                    className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200 object-cover"
                                    onClick={() => setPreviewUrl(fileUrl)}
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-slate-700">{job.date || '已保存记录'}</div>
                                  <div className="mt-0.5 text-xs text-slate-500">
                                    {job.result?.values ? `识别 ${Object.keys(job.result.values).length} 项指标` : '已保存'}
                                  </div>
                                </div>
                                <button
                                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                                  onClick={() => setDetailJob(job)}
                                >
                                  <Info size={14} />
                                  详情
                                </button>
                                <button
                                  className="p-2 text-slate-400 hover:text-red-500"
                                  onClick={() => handleCancelJob(job.id)}
                                  title="删除已保存任务"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {savedExpanded && savedJobs.length === 0 && (
                        <div className="mt-2 text-xs text-slate-400">暂无已保存任务</div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">检查日期</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-slate-700">事件标记</h3>
                  <p className="mt-1 text-xs text-slate-500">支持新增、编辑、删除。可单独记录症状、治疗或其他时间点，不需要填写化验值。</p>
                </div>
                {latestMarker && (
                  <div className="text-right text-xs text-slate-400">
                    <div>最近事件</div>
                    <div className="mt-1 text-slate-500">{latestMarker.date}</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">事件标题</label>
                  <input
                    value={markerTitle}
                    onChange={(e) => setMarkerTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：开始服药、出现发热、完成复查"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">事件备注 (可选)</label>
                  <textarea
                    value={markerNotes}
                    onChange={(e) => setMarkerNotes(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="补充背景信息，保存后将作为事件标记展示"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-100"
                  onClick={handleSaveMarker}
                >
                  {editingMarkerId ? '更新事件标记' : '保存事件标记'}
                </button>
                {editingMarkerId && (
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                    onClick={resetMarkerForm}
                  >
                    取消编辑
                  </button>
                )}
              </div>

              {sameDayMarkers.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-white p-3">
                  <div className="text-xs font-medium text-amber-700">{date} 已有 {sameDayMarkers.length} 条事件</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sameDayMarkers.map(marker => (
                      <span key={marker.id} className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                        {marker.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-700">最近事件</div>
                {sortedMarkers.length ? (
                  <div className="space-y-2">
                    {sortedMarkers.slice(0, 6).map(marker => (
                      <div key={marker.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">{marker.date}</span>
                              <span className="font-medium text-slate-800">{marker.title}</span>
                            </div>
                            {marker.notes ? (
                              <p className="mt-2 text-sm leading-6 text-slate-500">{marker.notes}</p>
                            ) : (
                              <p className="mt-2 text-sm text-slate-400">未填写备注</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
                              title="编辑事件"
                              onClick={() => loadMarkerIntoForm(marker)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              title="删除事件"
                              onClick={() => handleDeleteMarker(marker.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    还没有事件标记，保存后会同步出现在概览、趋势图和历史记录中。
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="border-b border-slate-100 pb-2 text-sm font-medium text-slate-700">指标数据</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
                {listIndicators.map(ind => (
                  <div key={ind.id}>
                    <label
                      className="mb-1 block truncate text-xs text-slate-500"
                      title={ind.name}
                    >
                      {ind.shortName || ind.name}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={values[ind.id] || ''}
                        onChange={(e) => setValues({ ...values, [ind.id]: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-16 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        placeholder="留空表示未查"
                      />
                      <span
                        className="absolute right-4 top-1/2 max-w-[4rem] -translate-y-1/2 truncate text-right text-xs text-slate-400"
                        title={ind.unit}
                      >
                        {ind.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">备注信息 (可选)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="例如：今天感觉有些乏力..."
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              保存记录
            </button>

            {uploadError && mode === 'manual' && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-600">
                <AlertCircle size={18} />
                {uploadError}
              </div>
            )}
          </form>
        )}
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative flex max-h-full w-full max-w-4xl items-center justify-center">
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300"
            >
              <X size={32} />
            </button>
            <img
              src={previewUrl}
              alt="Enlarged preview"
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {renderDetailModal()}
    </div>
  );
}
