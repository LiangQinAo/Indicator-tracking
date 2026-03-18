import { useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Charts } from './components/Charts';
import { AddRecord } from './components/AddRecord';
import { Settings } from './components/Settings';
import { RecordHistory } from './components/RecordHistory';

export default function App() {
  const { 
    records, 
    indicators, 
    isLoaded,
    addRecord,
    updateRecord,
    deleteRecord,
    addIndicator,
    updateIndicator,
    deleteIndicator,
    resetIndicators
  } = useAppStore();
  
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && (
        <Dashboard records={records} indicators={indicators} />
      )}
      {activeTab === 'charts' && (
        <Charts records={records} indicators={indicators} />
      )}
      {activeTab === 'history' && (
        <RecordHistory 
          records={records} 
          indicators={indicators} 
          onUpdate={updateRecord} 
          onDelete={deleteRecord} 
        />
      )}
      {activeTab === 'add' && (
        <AddRecord 
          indicators={indicators} 
          onAdd={(record) => {
            addRecord(record);
            setActiveTab('dashboard');
          }} 
          onAddIndicator={addIndicator}
        />
      )}
      {activeTab === 'settings' && (
        <Settings 
          indicators={indicators}
          onAdd={addIndicator}
          onUpdate={updateIndicator}
          onDelete={deleteIndicator}
          onReset={resetIndicators}
        />
      )}
    </Layout>
  );
}
