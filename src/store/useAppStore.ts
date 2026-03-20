import { useState, useEffect, useCallback, useRef } from 'react';
import { Indicator, MedicalRecord, EventMarker, DEFAULT_INDICATORS } from '../types';

const sortRecords = (items: MedicalRecord[]) => {
  return [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const sortIndicators = (items: Indicator[]) => {
  return [...items].sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER));
};

const sortMarkers = (items: EventMarker[]) => {
  return [...items].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;

    const aTime = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const bTime = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return bTime - aTime;
  });
};

export function useAppStore() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>(DEFAULT_INDICATORS);
  const [markers, setMarkers] = useState<EventMarker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const refreshInFlightRef = useRef(false);

  const refreshRecords = useCallback(async () => {
    const res = await fetch('/api/records');
    if (!res.ok) {
      throw new Error('Failed to fetch records');
    }

    const data = (await res.json()) as MedicalRecord[];
    setRecords(sortRecords(data));
    return data;
  }, []);

  const refreshIndicators = useCallback(async () => {
    const res = await fetch('/api/indicators');
    if (!res.ok) {
      throw new Error('Failed to fetch indicators');
    }

    const data = (await res.json()) as Indicator[];
    if (data.length > 0) {
      setIndicators(sortIndicators(data));
    }
    return data;
  }, []);

  const refreshMarkers = useCallback(async () => {
    const res = await fetch('/api/event-markers');
    if (!res.ok) {
      throw new Error('Failed to fetch event markers');
    }

    const data = (await res.json()) as EventMarker[];
    setMarkers(sortMarkers(data));
    return data;
  }, []);

  const refreshAll = useCallback(async () => {
    if (refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    setIsRefreshingAll(true);

    try {
      await Promise.all([refreshRecords(), refreshIndicators(), refreshMarkers()]);
    } catch (e) {
      console.error('Failed to refresh app data', e);
    } finally {
      setIsLoaded(true);
      setIsRefreshingAll(false);
      refreshInFlightRef.current = false;
    }
  }, [refreshIndicators, refreshMarkers, refreshRecords]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const addRecord = useCallback(async (record: MedicalRecord) => {
    try {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      setRecords(prev => sortRecords([...prev, record]));
    } catch (e) {
      console.error('Failed to add record', e);
    }
  }, []);

  const updateRecord = useCallback(async (updatedRecord: MedicalRecord) => {
    try {
      await fetch(`/api/records/${updatedRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecord)
      });
      setRecords(prev => sortRecords(prev.map(r => r.id === updatedRecord.id ? updatedRecord : r)));
    } catch (e) {
      console.error('Failed to update record', e);
    }
  }, []);

  const deleteRecord = useCallback(async (id: string) => {
    try {
      await fetch(`/api/records/${id}`, { method: 'DELETE' });
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error('Failed to delete record', e);
    }
  }, []);

  const addIndicator = useCallback(async (indicator: Indicator) => {
    try {
      await fetch('/api/indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(indicator)
      });
      setIndicators(prev => sortIndicators([...prev, indicator]));
    } catch (e) {
      console.error('Failed to add indicator', e);
    }
  }, []);

  const updateIndicator = useCallback(async (updatedIndicator: Indicator) => {
    try {
      await fetch(`/api/indicators/${updatedIndicator.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedIndicator)
      });
      setIndicators(prev => sortIndicators(prev.map(i => i.id === updatedIndicator.id ? updatedIndicator : i)));
    } catch (e) {
      console.error('Failed to update indicator', e);
    }
  }, []);

  const deleteIndicator = useCallback(async (id: string) => {
    try {
      await fetch(`/api/indicators/${id}`, { method: 'DELETE' });
      setIndicators(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      console.error('Failed to delete indicator', e);
    }
  }, []);

  const resetIndicators = useCallback(async () => {
    try {
      await fetch('/api/indicators/reset', { method: 'POST' });
      await refreshIndicators();
    } catch (e) {
      console.error('Failed to reset indicators', e);
    }
  }, [refreshIndicators]);

  const reorderIndicators = useCallback(async (ids: string[]) => {
    try {
      await fetch('/api/indicators/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      setIndicators(prev => sortIndicators(
        ids
          .map((id, index) => {
            const indicator = prev.find(i => i.id === id);
            return indicator ? { ...indicator, sort_order: index + 1 } : null;
          })
          .filter(Boolean) as Indicator[]
      ));
    } catch (e) {
      console.error('Failed to reorder indicators', e);
    }
  }, []);

  const addEventMarker = useCallback(async (marker: EventMarker) => {
    try {
      await fetch('/api/event-markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marker)
      });
      setMarkers(prev => sortMarkers([...prev, marker]));
    } catch (e) {
      console.error('Failed to add event marker', e);
    }
  }, []);

  const updateEventMarker = useCallback(async (updatedMarker: EventMarker) => {
    try {
      await fetch(`/api/event-markers/${updatedMarker.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMarker)
      });
      setMarkers(prev => sortMarkers(prev.map(marker => marker.id === updatedMarker.id ? updatedMarker : marker)));
    } catch (e) {
      console.error('Failed to update event marker', e);
    }
  }, []);

  const deleteEventMarker = useCallback(async (id: string) => {
    try {
      await fetch(`/api/event-markers/${id}`, { method: 'DELETE' });
      setMarkers(prev => prev.filter(marker => marker.id !== id));
    } catch (e) {
      console.error('Failed to delete event marker', e);
    }
  }, []);

  return {
    records,
    indicators,
    markers,
    isLoaded,
    isRefreshingAll,
    refreshAll,
    refreshRecords,
    refreshIndicators,
    refreshMarkers,
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
  };
}
