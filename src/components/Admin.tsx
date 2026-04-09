import { useEffect, useState } from 'react';

type Provider = 'gemini' | 'vertex' | 'codex';

export function Admin() {
  const [provider, setProvider] = useState<Provider>('gemini');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/admin/ai-provider');
      if (res.ok) {
        const data = await res.json();
        if (data?.provider === 'gemini' || data?.provider === 'vertex' || data?.provider === 'codex') {
          setProvider(data.provider);
        }
      }
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/admin/ai-provider', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider })
    });
    if (res.ok) {
      setMessage('已切换，后续任务生效');
    } else {
      setMessage('保存失败，请稍后再试');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">AI 引擎配置</h2>
        <div className="flex flex-col gap-3">
          <div className="text-sm text-slate-600">当前引擎</div>
          <div className="flex items-center gap-2">
            {(['gemini', 'vertex', 'codex'] as Provider[]).map((item) => (
              <button
                key={item}
                onClick={() => setProvider(item)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  provider === item
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {item === 'gemini' ? 'Gemini' : item === 'vertex' ? 'Vertex' : 'Codex'}
              </button>
            ))}
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="w-fit px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
          {message && (
            <div className="text-sm text-slate-600">{message}</div>
          )}
        </div>
      </div>
    </div>
  );
}
