import React, { useState, useCallback } from 'react';
import { Indicator, MedicalRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileImage, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { fileToBase64 } from '../lib/utils';
import { GoogleGenAI, Type } from '@google/genai';

interface AddRecordProps {
  indicators: Indicator[];
  onAdd: (record: MedicalRecord) => void;
  onAddIndicator: (indicator: Indicator) => void;
}

interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  date?: string;
  values?: Record<string, string>;
  newIndicators?: Indicator[];
  error?: string;
}

export function AddRecord({ indicators, onAdd, onAddIndicator }: AddRecordProps) {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const listIndicators = indicators.filter(i => i.isActive !== false && i.visibleInList !== false);

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

  const processBatchItem = async (item: BatchItem) => {
    setBatchItems(prev => prev.map(b => b.id === item.id ? { ...b, status: 'processing', error: undefined } : b));
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let retryCount = 0;
    let success = false;

    while (!success && retryCount < 3) {
      try {
        const base64 = await fileToBase64(item.file);
        const parts = [{
          inlineData: {
            data: base64,
            mimeType: item.file.type
          }
        }];

        const prompt = `
          请分析这张医疗化验单图片，提取以下信息：
          1. 检查日期 (YYYY-MM-DD格式)
          2. 所有的化验指标数据。

          【极其重要 - 核心指标】：请务必优先且准确地提取以下四个核心指标（只要化验单上有）：
          - 白细胞 (WBC)
          - 血红蛋白 (HGB)
          - 中性粒细胞计数 (NEUT#)
          - 血小板 (PLT)

          【极其重要 - 全面提取】：除了上述核心指标，请务必逐行扫描表格，提取出表格中的**每一项**化验指标！不要遗漏任何一行数据（例如：铁蛋白、尿酸、总胆固醇、甘油三酯、高密度脂蛋白胆固醇、低密度脂蛋白胆固醇等，只要在表格里就必须全部提取）。

          注意：
          1. 请仅提取表格中的实际化验指标！忽略页眉、页脚、医院名称、联系方式、备注说明等无关文本。
          2. 提取指标名称时，请去除名称前后的特殊符号（如☆、*等）和英文缩写（如(UA)、(TC)等），只保留纯中文名称（例如，将"☆尿酸 ( UA )"提取为"尿酸"）。

          我已经有一些预设的指标，列表如下：
          ${indicators.map(i => `- ID: ${i.id}, 名称: ${i.name}`).join('\n')}

          对于图片中提取到的每一个指标：
          - 如果它能对应上预设列表中的某个指标，请提供该指标的 'matchedId'。
          - 如果它是预设列表中没有的新指标，请不要提供 'matchedId'，但必须提供它的 'name' (名称), 'unit' (单位), 以及参考范围的 'minNormal' 和 'maxNormal' (如果有的话)。名称和单位必须简短（不超过20个字符）。
          - 必须提供提取到的数值 'value'。
        `;

        // Add a 30-second timeout to prevent the request from hanging indefinitely
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), 30000);
        });

        const response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [...parts, { text: prompt }] },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: "检查日期，格式 YYYY-MM-DD" },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        matchedId: { type: Type.STRING, description: "如果匹配到预设指标，填入对应的ID" },
                        name: { type: Type.STRING, description: "指标名称（简短，如'白细胞'）" },
                        value: { type: Type.NUMBER, description: "检测数值" },
                        unit: { type: Type.STRING, description: "单位（简短，如'10^9/L'）" },
                        minNormal: { type: Type.NUMBER, description: "正常范围下限" },
                        maxNormal: { type: Type.NUMBER, description: "正常范围上限" }
                      },
                      required: ["name", "value"]
                    }
                  }
                }
              }
            }
          }),
          timeoutPromise
        ]) as any;

        const resultText = response.text || '{}';
        const result = JSON.parse(resultText);

        const newValues: Record<string, string> = {};
        const newInds: Indicator[] = [];
        const colors = ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6'];

        if (result.items && Array.isArray(result.items)) {
          result.items.forEach((resItem: any) => {
            if (resItem.value === null || resItem.value === undefined) return;

            if (resItem.matchedId && indicators.some(ind => ind.id === resItem.matchedId)) {
              newValues[resItem.matchedId] = String(resItem.value);
            } else if (resItem.name && typeof resItem.name === 'string' && resItem.name.length <= 30) {
              const newId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              const newIndicator: Indicator = {
                id: newId,
                name: resItem.name.trim(),
                unit: (resItem.unit && typeof resItem.unit === 'string') ? resItem.unit.substring(0, 20).trim() : '',
                minNormal: resItem.minNormal,
                maxNormal: resItem.maxNormal,
                color: colors[Math.floor(Math.random() * colors.length)]
              };
              newInds.push(newIndicator);
              newValues[newId] = String(resItem.value);
            }
          });
        }

        setBatchItems(prev => prev.map(b => b.id === item.id ? { 
          ...b, 
          status: 'success',
          date: result.date || new Date().toISOString().split('T')[0],
          values: newValues,
          newIndicators: newInds
        } : b));
        
        success = true;

      } catch (error: any) {
        console.error('AI OCR Error for image:', item.file.name, error);
        const isRateLimit = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED');
        
        if (isRateLimit && retryCount < 2) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 2000 + Math.random() * 1000;
          console.log(`Rate limited. Retrying image ${item.file.name} in ${Math.round(delay/1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          setBatchItems(prev => prev.map(b => b.id === item.id ? { 
            ...b, 
            status: 'error',
            error: isRateLimit ? '请求过于频繁，请稍后再试' : '识别失败，请检查图片清晰度'
          } : b));
          break;
        }
      }
    }
    
    return success;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const newItems: BatchItem[] = acceptedFiles.map(file => ({
      id: uuidv4(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending'
    }));

    setBatchItems(prev => [...prev, ...newItems]);
    setMode('ai');
    setUploadError(null);

    for (const item of newItems) {
      const success = await processBatchItem(item);
      if (success) {
        // Add a small delay between processing different images to help avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  }, [indicators]);

  const handleSaveBatch = () => {
    const successfulItems = batchItems.filter(b => b.status === 'success');
    
    successfulItems.forEach(item => {
      if (item.newIndicators) {
        item.newIndicators.forEach(ind => onAddIndicator(ind));
      }
      
      const parsedValues: Record<string, number> = {};
      if (item.values) {
        Object.entries(item.values).forEach(([key, val]) => {
          if (val && !isNaN(Number(val))) {
            parsedValues[key] = Number(val);
          }
        });
      }
      
      onAdd({
        id: uuidv4(),
        date: item.date || new Date().toISOString().split('T')[0],
        values: parsedValues,
        notes: 'AI 批量导入'
      });
    });
    
    setBatchItems([]);
  };

  const removeBatchItem = (id: string) => {
    setBatchItems(prev => prev.filter(b => b.id !== id));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] }
  } as any);

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
            {batchItems.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-slate-800">
                    批量识别结果 ({batchItems.filter(b => b.status === 'success').length}/{batchItems.length})
                  </h3>
                  <button 
                    onClick={() => setBatchItems([])}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    清空列表
                  </button>
                </div>
                
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                  {batchItems.map(item => (
                    <div key={item.id} className="flex items-center gap-4 p-3 border border-slate-100 rounded-xl bg-slate-50 relative group">
                      <img 
                        src={item.previewUrl} 
                        alt="preview" 
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                        onClick={() => setPreviewImage(item.previewUrl)}
                      />
                      <div className="flex-1 min-w-0">
                        {item.status === 'pending' && <p className="text-slate-500 text-sm">等待处理...</p>}
                        {item.status === 'processing' && (
                          <div className="flex items-center gap-2 text-blue-600 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>正在识别...</span>
                          </div>
                        )}
                        {item.status === 'success' && (
                          <>
                            <p className="text-sm font-medium text-slate-800">日期: {item.date}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              成功提取 {Object.keys(item.values || {}).length} 个指标 
                              {item.newIndicators && item.newIndicators.length > 0 && ` (包含 ${item.newIndicators.length} 个新指标)`}
                            </p>
                          </>
                        )}
                        {item.status === 'error' && (
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-red-500 flex items-center gap-1">
                              <AlertCircle size={14} /> {item.error}
                            </p>
                            <button 
                              onClick={() => processBatchItem(item)}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              重试
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {item.status === 'success' && <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />}
                      
                      <button 
                        onClick={() => removeBatchItem(item.id)}
                        className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 rounded-full p-1.5 shadow-sm border border-slate-200 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <div 
                    {...getRootProps()} 
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors text-center cursor-pointer"
                  >
                    <input {...getInputProps()} />
                    继续添加图片
                  </div>
                  <button
                    onClick={handleSaveBatch}
                    disabled={batchItems.some(b => b.status === 'processing' || b.status === 'pending') || batchItems.filter(b => b.status === 'success').length === 0}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    保存全部成功记录
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                      <UploadCloud size={32} />
                    </div>
                    <div>
                      <p className="text-slate-700 font-medium text-lg">点击或拖拽化验单图片至此</p>
                      <p className="text-slate-500 text-sm mt-1">支持批量上传，AI 将自动提取指标数据</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 flex items-start gap-3">
                  <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
                  <p>提示：请确保上传的图片清晰。AI 将自动提取所有指标数据，如果遇到系统中未预设的新指标，将自动为您创建。</p>
                </div>
              </div>
            )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl w-full max-h-full flex items-center justify-center">
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 p-2"
            >
              <X size={32} />
            </button>
            <img 
              src={previewImage} 
              alt="Enlarged preview" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
