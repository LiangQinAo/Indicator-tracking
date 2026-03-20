import { useAppStore } from './store/useAppStore';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Charts } from './components/Charts';
import { AddRecord } from './components/AddRecord';
import { Settings } from './components/Settings';
import { RecordHistory } from './components/RecordHistory';
import { Reports } from './components/Reports';
import { Admin } from './components/Admin';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

export default function App() {
  const {
    records,
    indicators,
    markers,
    isLoaded,
    isRefreshingAll,
    refreshAll,
    addRecord,
    updateRecord,
    deleteRecord,
    addIndicator,
    updateIndicator,
    deleteIndicator,
    resetIndicators,
    reorderIndicators,
    addEventMarker,
    updateEventMarker,
    deleteEventMarker,
  } = useAppStore();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const AddRecordRoute = () => {
    const navigate = useNavigate();
    return (
      <AddRecord
        records={records}
        indicators={indicators}
        markers={markers}
        onAdd={(record) => {
          addRecord(record);
          navigate('/');
        }}
        onUpdate={updateRecord}
        onAddIndicator={addIndicator}
        onAddMarker={addEventMarker}
        onUpdateMarker={updateEventMarker}
        onDeleteMarker={deleteEventMarker}
      />
    );
  };

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                records={records}
                indicators={indicators}
                markers={markers}
                onRefresh={refreshAll}
                isRefreshing={isRefreshingAll}
              />
            }
          />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route
            path="/charts"
            element={
              <Charts
                records={records}
                indicators={indicators}
                markers={markers}
                onRefresh={refreshAll}
                isRefreshing={isRefreshingAll}
              />
            }
          />
          <Route
            path="/history"
            element={
              <RecordHistory
                records={records}
                indicators={indicators}
                markers={markers}
                onRefresh={refreshAll}
                isRefreshing={isRefreshingAll}
                onUpdate={updateRecord}
                onDelete={deleteRecord}
              />
            }
          />
          <Route
            path="/add"
            element={<AddRecordRoute />}
          />
          <Route
            path="/settings"
            element={
              <Settings
                indicators={indicators}
                onAdd={addIndicator}
                onUpdate={updateIndicator}
                onDelete={deleteIndicator}
                onReset={resetIndicators}
                onReorder={reorderIndicators}
              />
            }
          />
          <Route path="/reports" element={<Reports />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
