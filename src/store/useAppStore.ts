import { useState, useEffect, useCallback } from 'react';
import { Indicator, MedicalRecord, DEFAULT_INDICATORS } from '../types';

export function useAppStore() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>(DEFAULT_INDICATORS);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [recordsRes, indicatorsRes] = await Promise.all([
        fetch('/api/records'),
        fetch('/api/indicators')
      ]);
      
      if (recordsRes.ok) {
        const data = await recordsRes.json();
        setRecords(data);
      }
      
      if (indicatorsRes.ok) {
        const data = await indicatorsRes.json();
        if (data && data.length > 0) {
          setIndicators(data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch data', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addRecord = useCallback(async (record: MedicalRecord) => {
    try {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      setRecords(prev => [...prev, record].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
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
      setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
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
      setIndicators(prev => [...prev, indicator]);
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
      setIndicators(prev => prev.map(i => i.id === updatedIndicator.id ? updatedIndicator : i));
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
      fetchData(); // Refetch to get the default indicators from server
    } catch (e) {
      console.error('Failed to reset indicators', e);
    }
  }, [fetchData]);

  const reorderIndicators = useCallback(async (ids: string[]) => {
    try {
      await fetch('/api/indicators/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      setIndicators(prev => ids.map(id => prev.find(i => i.id === id)).filter(Boolean) as Indicator[]);
    } catch (e) {
      console.error('Failed to reorder indicators', e);
    }
  }, []);

  return {
    records,
    indicators,
    isLoaded,
    addRecord,
    updateRecord,
    deleteRecord,
    addIndicator,
    updateIndicator,
    deleteIndicator,
    resetIndicators,
    reorderIndicators,
  };
}
