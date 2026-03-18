import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Indicator, MedicalRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2, AlertCircle, X, FileText, Info, Trash2, RotateCw } from 'lucide-react';

interface AddRecordProps {
  records: MedicalRecord[];
  indicators: Indicator[];
  onAdd: (record: MedicalRecord) => void;
  onUpdate: (record: MedicalRecord) => void;
  onAddIndicator: (indicator: Indicator) => void;
}

interface AiJobResult {
  date: string;
  values: Record<string, number>;
  newIndicators?: Indicator[];
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

export function AddRecord({ records, indicators, onAdd, onUpdate, onAddIndicator }: AddRecordProps) {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detailJob, setDetailJob] = useState<AiJob | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const listIndicators = indicators.filter(i => i.isActive !== false && i.visibleInList !== false);

  const loadJobs = useCallback(async () => {
    const res = await fetch('/api/ai-jobs');
    if (res.ok) {
      const data = await res.json();
      setJobs(data);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const timer = setInterval(loadJobs, 3000);
    return () => clearInterval(timer);
  }, [loadJobs]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
      notes
    });

    setValues({});
    setNotes('');
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploadError(null);
    setMode('ai');

    const newItems = acceptedFiles.map(file => ({
      id: uuidv4(),
      file,
      previewUrl: file.type.includes('pdf') ? undefined : URL.createObjectURL(file),
      isPdf: file.type.includes('pdf')
    }));
    setPendingFiles(prev => [...prev, ...newItems]);
  }, [loadJobs]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'application/pdf': ['.pdf'] }
  } as any);

  const resolveJob = async (id: string, status: 'saved' | 'ignored') => {
    await fetch(`/api/ai-jobs/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
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
    onAdd({
      id: uuidv4(),
      date: job.result.date,
      values: job.result.values,
      notes: 'AI 识别导入'
    });
    await resolveJob(job.id, 'saved');
  };

  const overwriteJobRecord = async (job: AiJob) => {
    if (!job.result || !job.conflict) return;
    const existing = records.find(r => r.id === job.conflict?.recordId);
    if (!existing) {
      return;
    }
    const mergedValues = { ...existing.values, ...job.result.values };
    onUpdate({
      ...existing,
      date: job.result.date,
      values: mergedValues
    });
    await resolveJob(job.id, 'saved');
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
          className="relative max-w-5xl w-full max-h-full bg-white rounded-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <span className="font-medium text-slate-800">识别详情</span>
            <button className="text-slate-500 hover:text-slate-700" onClick={() => setDetailJob(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="text-sm text-slate-600">日期：{detailJob.result.date}</div>

            <div className="bg-slate-50 rounded-lg p-3">
              {isPdf ? (
                <iframe src={fileUrl} className="w-full h-[50vh]" title="ai-preview" />
              ) : (
                <img src={fileUrl} alt="ai-preview" className="w-full max-h-[50vh] object-contain" />
              )}
            </div>

            <div>
              <h4 className="font-medium text-slate-700 mb-2">识别指标</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {valuesList.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">{indicatorNameMap.get(key) || key}</span>
                    <span className="font-medium text-slate-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {detailJob.result.newIndicators && detailJob.result.newIndicators.length > 0 && (
              <div>
                <h4 className="font-medium text-slate-700 mb-2">新指标</h4>
                <div className="space-y-1 text-sm">
                  {detailJob.result.newIndicators.map(ind => (
                    <div key={ind.id} className="text-slate-600">{ind.name} ({ind.unit || '无单位'})</div>
                  ))}
                </div>
              </div>
            )}

            {detailJob.status === 'conflict' && (
              <div className="border border-red-100 bg-red-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-600 mb-2">
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
                  <div className="text-sm text-red-600">同日期已有记录，请确认是否覆盖。</div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm"
                    onClick={() => { overwriteJobRecord(detailJob); setDetailJob(null); }}
                  >
                    覆盖保存
                  </button>
                  <button
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                    onClick={() => { resolveJob(detailJob.id, 'ignored'); setDetailJob(null); }}
                  >
                    放弃保存
                  </button>
                </div>
              </div>
            )}

            {detailJob.status !== 'conflict' && (
              <button
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm"
                onClick={() => { saveJobRecord(detailJob); setDetailJob(null); }}
              >
                保存记录
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex bg-slate-100 p-1 rounded-xl w-full">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            mode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          手动录入
        </button>
        <button
          onClick={() => setMode('ai')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            mode === 'ai' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          AI 智能识别
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {mode === 'ai' ? (
          <div className="space-y-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                  <UploadCloud size={28} />
                </div>
                <div>
                  <p className="text-slate-700 font-medium">点击或拖拽化验单图片 / PDF 至此</p>
                  <p className="text-slate-500 text-sm mt-1">识别任务将在后台处理，关闭页面也不会中断</p>
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
                    <div key={item.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50">
                      {item.isPdf ? (
                        <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                          <FileText size={18} />
                        </div>
                      ) : (
                        <img
                          src={item.previewUrl}
                          alt="preview"
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 cursor-pointer"
                          onClick={() => setPreviewUrl(item.previewUrl || null)}
                        />
                      )}
                      <div className="flex-1 min-w-0 text-sm text-slate-700 truncate">
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
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  onClick={submitPendingFiles}
                  disabled={submitting}
                >
                  {submitting ? '提交中...' : '开始识别'}
                </button>
              </div>
            )}

            {uploadError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm">
                <AlertCircle size={16} />
                {uploadError}
              </div>
            )}

            <div className="space-y-3">
              {jobs.length === 0 && (
                <div className="text-slate-500 text-sm">暂无识别任务</div>
              )}
              {jobs.map(job => {
                const fileUrl = `/api/ai-jobs/${job.id}/file`;
                const isPdf = job.mime?.includes('pdf');
                const statusLabel = {
                  pending: '等待处理',
                  processing: '识别中',
                  success: '可保存',
                  conflict: '冲突待处理',
                  error: '识别失败',
                  saved: '已保存',
                  ignored: '已忽略'
                }[job.status];
                return (
                  <div key={job.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50">
                    {isPdf ? (
                      <div className="w-14 h-14 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                        <FileText size={20} />
                      </div>
                    ) : (
                      <img
                        src={fileUrl}
                        alt="preview"
                        className="w-14 h-14 object-cover rounded-lg border border-slate-200 cursor-pointer"
                        onClick={() => setPreviewUrl(fileUrl)}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{job.date || '待识别日期'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          job.status === 'conflict' ? 'bg-red-50 text-red-600' :
                          job.status === 'error' ? 'bg-rose-50 text-rose-600' :
                          job.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                          job.status === 'processing' ? 'bg-blue-50 text-blue-600' :
                          job.status === 'saved' ? 'bg-slate-100 text-slate-500' :
                          'bg-slate-100 text-slate-500'
                        }`}>{statusLabel}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {job.result?.values ? `识别 ${Object.keys(job.result.values).length} 项指标` : job.error || '等待处理...'}
                      </div>
                    </div>

                    {job.status === 'processing' && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    )}

                    {(job.status === 'pending' || job.status === 'processing') && (
                      <button
                        className="p-2 text-slate-400 hover:text-red-500"
                        onClick={() => handleCancelJob(job.id)}
                        title="取消任务"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    {job.status === 'error' && (
                      <div className="flex items-center gap-1">
                        <button
                          className="p-2 text-slate-400 hover:text-blue-600"
                          onClick={() => handleRetryJob(job.id)}
                          title="重试"
                        >
                          <RotateCw size={16} />
                        </button>
                        <button
                          className="p-2 text-slate-400 hover:text-red-500"
                          onClick={() => handleCancelJob(job.id)}
                          title="删除任务"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}

                    {(job.status === 'success' || job.status === 'conflict') && (
                      <button
                        className="px-2 py-1 text-xs rounded-lg border border-slate-200 text-slate-700 flex items-center gap-1"
                        onClick={() => setDetailJob(job)}
                      >
                        <Info size={14} />
                        详情
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">检查日期</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-700 border-b border-slate-100 pb-2">指标数据</h3>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                {listIndicators.map(ind => (
                  <div key={ind.id}>
                    <label
                      className="block text-xs text-slate-500 mb-1 truncate"
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
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-16"
                        placeholder="留空表示未查"
                      />
                      <span
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 max-w-[4rem] truncate text-right"
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
              <label className="block text-sm font-medium text-slate-700 mb-2">备注信息 (可选)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                placeholder="例如：今天感觉有些乏力..."
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              保存记录
            </button>

            {uploadError && mode === 'manual' && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl text-sm mt-4">
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
          <div className="relative max-w-4xl w-full max-h-full flex items-center justify-center">
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 p-2"
            >
              <X size={32} />
            </button>
            <img
              src={previewUrl}
              alt="Enlarged preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {renderDetailModal()}
    </div>
  );
}
