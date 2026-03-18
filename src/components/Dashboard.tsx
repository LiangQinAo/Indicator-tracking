import { useState } from 'react';
import { Indicator, MedicalRecord } from '../types';
import { format, parseISO } from 'date-fns';
import { AlertCircle, CheckCircle2, Bot, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface DashboardProps {
  records: MedicalRecord[];
  indicators: Indicator[];
}

export function Dashboard({ records, indicators }: DashboardProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const latestRecord = records[0];

  const handleAnalyze = async () => {
    if (!records.length) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
        你是一位专业的血液科医生助手。请根据以下白血病患者的近期检查指标历史数据，提供一份简短、专业、鼓励性的趋势分析报告。
        请重点关注异常指标的趋势变化，并给出日常护理建议。
        注意：请在结尾添加免责声明，提醒患者此为AI分析，最终诊断和治疗方案需遵医嘱。
        
        指标定义：
        ${indicators.map(i => `${i.name} (${i.unit}) - 正常范围: ${i.minNormal ?? '无'} ~ ${i.maxNormal ?? '无'}`).join('\n')}
        
        历史数据（按时间倒序）：
        ${JSON.stringify(records.slice(0, 10).map(r => ({
          date: r.date,
          values: Object.fromEntries(
            Object.entries(r.values).map(([k, v]) => [indicators.find(i => i.id === k)?.name || k, v])
          )
        })), null, 2)}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      setAnalysis(response.text || '无法生成分析报告。');
    } catch (error) {
      console.error(error);
      setAnalysis('分析过程中发生错误，请稍后再试。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const listIndicators = indicators.filter(i => i.isActive !== false && i.visibleInList !== false);

  if (!records.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="text-blue-500" size={32} />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">暂无数据</h2>
        <p className="text-slate-500 mt-1">请先录入或上传您的化验单数据。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">最新检查结果</h2>
          <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {format(parseISO(latestRecord.date), 'yyyy-MM-dd')}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {listIndicators.map(indicator => {
            const value = latestRecord.values[indicator.id];
            if (value === undefined) return null;

            const isAbnormal = 
              (indicator.minNormal !== undefined && value < indicator.minNormal) ||
              (indicator.maxNormal !== undefined && value > indicator.maxNormal);

            return (
              <div key={indicator.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col">
                <span className="text-sm text-slate-500 mb-1" title={indicator.name}>{indicator.name}</span>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-bold ${isAbnormal ? 'text-red-600' : 'text-slate-800'}`}>
                    {value}
                  </span>
                  <span className="text-xs text-slate-400 mb-1">{indicator.unit}</span>
                </div>
                {isAbnormal ? (
                  <div className="flex items-center gap-1 mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md w-fit">
                    <AlertCircle size={12} />
                    <span>异常 (正常: {indicator.minNormal}-{indicator.maxNormal})</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md w-fit">
                    <CheckCircle2 size={12} />
                    <span>正常</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-sm border border-blue-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
              <Bot size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">AI 智能趋势分析</h2>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Bot size={18} />}
            {isAnalyzing ? '分析中...' : '生成分析'}
          </button>
        </div>

        {analysis && (
          <div className="mt-4 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-blue-100 text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
            {analysis}
          </div>
        )}
      </div> */}
    </div>
  );
}
