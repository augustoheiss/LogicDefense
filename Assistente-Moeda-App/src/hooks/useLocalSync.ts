/**
 * useLocalSync Hook — Assistente Moeda
 *
 * Manages real-time Local SSE Sync & Offline Queue Drainage via Local API Key.
 * Zero Cloud DB — syncs directly with browser IndexedDB / AsyncStorage.
 * Tracks global timeline sequence number (seq_number) and key rotation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useCoinDB } from './useCoinDB';
import type { TableRow } from '../core/types';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1/public';

export interface AuditLogItem {
  id: string;
  tableId: string;
  timestamp: string;
  origin: 'python' | 'whatsapp' | 'csv' | 'web_ui';
  seqNumber: number;
  description: string;
  impactText: string;
  rowsCount: number;
  rowIds: string[];
}

export type SyncStatus = 'connected' | 'syncing' | 'disconnected' | 'error' | 'key_rotated';

export function useLocalSync() {
  const db = useCoinDB();
  const activeTable = db.activeTable;
  const tableId = activeTable?.id;

  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const [lastSeqNumber, setLastSeqNumber] = useState<number>(0);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  const eventSourceRef = useRef<any>(null);

  // Helper: Read API key from localStorage for a specific tableId
  const getStoredApiKey = useCallback((tid?: string): string | null => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const targetId = tid || tableId;
    if (!targetId) return null;
    return window.localStorage.getItem(`coin_api_key_${targetId}`);
  }, [tableId]);

  // Helper: Store API key in localStorage for a specific tableId
  const setApiKey = useCallback((key: string, tid?: string) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const targetId = tid || tableId;
    if (targetId) {
      window.localStorage.setItem(`coin_api_key_${targetId}`, key);
    }
    setApiKeyState(key);
  }, [tableId]);

  // Helper: Get sequence number scoped strictly by tableId
  const getStoredSeqNumber = useCallback((tid?: string): number => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) {
      return 0;
    }
    const targetId = tid || tableId;
    if (!targetId) return 0;
    const val = window.localStorage.getItem(`coin_last_seq_${targetId}`);
    return val ? parseInt(val, 10) || 0 : 0;
  }, [tableId]);

  // Helper: Save sequence number scoped strictly by tableId
  const saveLastSeqNumber = useCallback((seq: number, tid?: string) => {
    setLastSeqNumber(seq);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const targetId = tid || tableId;
      if (targetId) {
        window.localStorage.setItem(`coin_last_seq_${targetId}`, String(seq));
      }
    }
  }, [tableId]);

  // Helper: Load audit logs scoped strictly by tableId
  const loadStoredAuditLogs = useCallback((tid?: string): AuditLogItem[] => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    const targetId = tid || tableId;
    if (!targetId) return [];
    try {
      const raw = window.localStorage.getItem(`coin_audit_events_${targetId}`);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn('Error reading stored audit logs:', err);
      return [];
    }
  }, [tableId]);

  // Helper: Save audit logs scoped strictly by tableId
  const saveAuditLogs = useCallback((logs: AuditLogItem[], tid?: string) => {
    setAuditLogs(logs);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const targetId = tid || tableId;
      if (targetId) {
        window.localStorage.setItem(`coin_audit_events_${targetId}`, JSON.stringify(logs));
      }
    }
  }, [tableId]);

  // Add audit log helper (scoped by tableId)
  const pushAuditLog = useCallback((item: Omit<AuditLogItem, 'id' | 'timestamp' | 'tableId'>, tid?: string) => {
    const currentTableId = tid || tableId;
    if (!currentTableId) return;
    const newLog: AuditLogItem = {
      ...item,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tableId: currentTableId,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setAuditLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`coin_audit_events_${currentTableId}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [tableId]);

  // Reactive state reset & reload on tableId change
  useEffect(() => {
    if (!tableId) {
      setAuditLogs([]);
      setLastSeqNumber(0);
      setApiKeyState(null);
      return;
    }

    // 1. Reload isolated key, sequence number, and audit logs for THIS tableId
    const key = getStoredApiKey(tableId);
    const seq = getStoredSeqNumber(tableId);
    const logs = loadStoredAuditLogs(tableId);

    setApiKeyState(key);
    setLastSeqNumber(seq);
    setAuditLogs(logs);
  }, [tableId, getStoredApiKey, getStoredSeqNumber, loadStoredAuditLogs]);

  // 1. Drain offline pending queue
  const forceSyncPending = useCallback(async () => {
    const activeKey = getStoredApiKey(tableId) || apiKey;
    if (!activeKey || !tableId) {
      setStatus('disconnected');
      return;
    }

    try {
      setStatus('syncing');
      const url = `${API_BASE_URL}/sync/pending?api_key=${encodeURIComponent(activeKey)}&since_seq=${lastSeqNumber}`;
      const res = await fetch(url);
      
      if (res.status === 401) {
        setStatus('key_rotated');
        return;
      }

      if (!res.ok) {
        setStatus('error');
        return;
      }

      const data = await res.json();
      if (data.success && data.events && data.events.length > 0) {
        let maxSeq = lastSeqNumber;
        for (const evt of data.events) {
          if (evt.rows && evt.rows.length > 0) {
            await db.importSpreadsheet({
              rows: evt.rows,
              mode: evt.mode || 'merge',
            });

            const totalValue = evt.rows.reduce((acc: number, r: TableRow) => acc + (Number(r.value) || 0), 0);
            const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue);

            pushAuditLog({
              origin: evt.rows[0]?.id?.includes('n8n') ? 'whatsapp' : 'python',
              seqNumber: evt.seqNumber || maxSeq + 1,
              description: `Drenou ${evt.rows.length} lançamentos pendentes`,
              impactText: `${evt.rows.length} itens - Total ${formattedVal}`,
              rowsCount: evt.rows.length,
              rowIds: evt.rows.map((r: TableRow) => r.id),
            }, tableId);
          }

          if (evt.seqNumber && evt.seqNumber > maxSeq) {
            maxSeq = evt.seqNumber;
          }
        }

        saveLastSeqNumber(maxSeq, tableId);
      }

      setStatus('connected');
    } catch (err) {
      console.warn('Failed to drain pending sync queue:', err);
      setStatus('error');
    }
  }, [apiKey, getStoredApiKey, lastSeqNumber, db, pushAuditLog, tableId, saveLastSeqNumber]);

  // Helper: Synchronize active table rows to the local backend RAM
  const pushActiveTableSnapshot = useCallback(async () => {
    const activeKey = getStoredApiKey(tableId) || apiKey;
    if (!activeKey || !tableId || !activeTable?.rows || activeTable.rows.length === 0) {
      return;
    }
    try {
      await fetch(`${API_BASE_URL}/transactions/batch-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Spreadsheet-Key': activeKey,
          'X-Origin-Browser': 'true',
        },
        body: JSON.stringify({
          mode: 'replace',
          transactions: activeTable.rows.map((r: TableRow) => ({
            date: r.date,
            value: r.entryType === 'expense' ? -Math.abs(r.value) : Math.abs(r.value),
            description: r.description,
            entry_type: r.entryType,
            category: r.category,
            tags: r.tags,
            external_id: r.id,
            period_start: r.periodStart,
            period_end: r.periodEnd,
          }))
        })
      });
    } catch (err) {
      console.warn('Failed to push table snapshot to backend:', err);
    }
  }, [getStoredApiKey, tableId, apiKey, activeTable?.rows]);

  // Push snapshot whenever activeTable rows change or table is loaded
  useEffect(() => {
    if (activeTable?.rows && activeTable.rows.length > 0) {
      pushActiveTableSnapshot();
    }
  }, [activeTable?.rows, pushActiveTableSnapshot]);

  // Listen for CSV import / key update sync requests
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleSyncRequest = (e: any) => {
      const detail = e.detail || {};
      const targetTableId = detail.tableId || tableId;
      if (targetTableId && targetTableId !== tableId) return;

      const key = detail.apiKey || getStoredApiKey(targetTableId);
      if (key) {
        setApiKeyState(key);
        if (detail.lastEventSeq !== undefined) {
          saveLastSeqNumber(detail.lastEventSeq, targetTableId);
        }
        setTimeout(() => {
          forceSyncPending();
          pushActiveTableSnapshot();
        }, 100);
      }
    };

    window.addEventListener('coin_sync_requested', handleSyncRequest);
    return () => {
      window.removeEventListener('coin_sync_requested', handleSyncRequest);
    };
  }, [tableId, getStoredApiKey, saveLastSeqNumber, forceSyncPending, pushActiveTableSnapshot]);

  // 2. Open Real-Time SSE Connection (Reconnected per tableId)
  useEffect(() => {
    const activeKey = getStoredApiKey(tableId);
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !activeKey || !tableId || !window.EventSource) {
      setStatus('disconnected');
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sseUrl = `${API_BASE_URL}/sync/stream?api_key=${encodeURIComponent(activeKey)}`;
    const es = new window.EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus('connected');
    };

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.event === 'KEY_ROTATED') {
          setStatus('key_rotated');
          es.close();
          return;
        }

        if (payload.event === 'MUTATION' && payload.rows) {
          db.importSpreadsheet({
            rows: payload.rows,
            mode: payload.mode || 'merge',
          });

          if (payload.seqNumber) {
            saveLastSeqNumber(payload.seqNumber, tableId);
          }

          const totalValue = payload.rows.reduce((acc: number, r: TableRow) => acc + (Number(r.value) || 0), 0);
          const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue);

          pushAuditLog({
            origin: payload.rows[0]?.id?.includes('n8n') ? 'whatsapp' : 'python',
            seqNumber: payload.seqNumber || lastSeqNumber + 1,
            description: `Adicionou ${payload.rows.length} lançamentos em tempo real`,
            impactText: `${payload.rows.length} itens - Total ${formattedVal}`,
            rowsCount: payload.rows.length,
            rowIds: payload.rows.map((r: TableRow) => r.id),
          }, tableId);
        }
      } catch (err) {
        console.warn('Error parsing SSE event:', err);
      }
    };

    es.onerror = () => {
      setStatus('disconnected');
    };

    // Initial queue drain on connection
    forceSyncPending();

    return () => {
      es.close();
    };
  }, [tableId, getStoredApiKey, forceSyncPending, db, pushAuditLog, saveLastSeqNumber, lastSeqNumber]);

  // 3. Safe undo audit log event with strict tableId validation
  const undoAuditLog = useCallback(async (logId: string) => {
    const targetLog = auditLogs.find((l) => l.id === logId);
    if (!targetLog) return;

    // SECURITY CHECK: Validate event belongs strictly to activeTableId
    if (targetLog.tableId && targetLog.tableId !== tableId) {
      console.warn(`[Security Guard] Blocked undo action for event tableId (${targetLog.tableId}) which differs from activeTableId (${tableId})`);
      return;
    }

    for (const rid of targetLog.rowIds) {
      if (rid) {
        db.deleteRow(rid);
      }
    }

    const updated = auditLogs.filter((l) => l.id !== logId);
    saveAuditLogs(updated, tableId);
  }, [auditLogs, db, tableId, saveAuditLogs]);

  return {
    status,
    lastSeqNumber,
    auditLogs,
    apiKey,
    setApiKey,
    forceSyncPending,
    undoAuditLog,
  };
}

