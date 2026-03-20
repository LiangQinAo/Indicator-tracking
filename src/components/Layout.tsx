import React from 'react';
import { LayoutDashboard, LineChart, PlusCircle, Settings, List, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { id: 'dashboard', label: '概览', icon: LayoutDashboard, path: '/' },
    { id: 'charts', label: '趋势图', icon: LineChart, path: '/charts' },
    { id: 'history', label: '历史记录', icon: List, path: '/history' },
    { id: 'add', label: '录入数据', icon: PlusCircle, path: '/add' },
    { id: 'settings', label: '指标设置', icon: Settings, path: '/settings' },
    { id: 'reports', label: '报告管理', icon: FileText, path: '/reports' },
  ];

  const activePath = location.pathname === '/dashboard' ? '/' : location.pathname;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 text-slate-900 md:h-[100dvh] md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200">
        <div className="p-6">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <LineChart className="text-blue-600" />
            指标追踪
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium",
                  activePath === item.path
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+6.5rem)] md:pb-0">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-4 md:min-h-0 md:p-8">
          {/* Mobile Header */}
          <header className="mb-6 flex shrink-0 items-center gap-2 md:hidden">
            <LineChart className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-800">指标追踪</h1>
          </header>
          <div className="flex flex-1 flex-col md:min-h-0">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white pb-safe md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-1 py-3 px-4 flex-1",
                activePath === item.path ? "text-blue-600" : "text-slate-500"
              )}
            >
              <Icon size={24} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
