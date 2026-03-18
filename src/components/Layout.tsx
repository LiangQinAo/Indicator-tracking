import React, { useState } from 'react';
import { LayoutDashboard, LineChart, PlusCircle, Settings, List, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const navItems = [
    { id: 'dashboard', label: '概览', icon: LayoutDashboard },
    { id: 'charts', label: '趋势图', icon: LineChart },
    { id: 'history', label: '历史记录', icon: List },
    { id: 'add', label: '录入数据', icon: PlusCircle },
    { id: 'settings', label: '指标设置', icon: Settings },
    { id: 'reports', label: '报告管理', icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
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
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium",
                  activeTab === item.id
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
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-8">
          {/* Mobile Header */}
          <header className="md:hidden mb-6 flex items-center gap-2">
            <LineChart className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-800">指标追踪</h1>
          </header>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 py-3 px-4 flex-1",
                activeTab === item.id ? "text-blue-600" : "text-slate-500"
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
