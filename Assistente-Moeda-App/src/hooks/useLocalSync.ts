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

  // Helper: Read API key from localStorage for this tableId
  const getStoredApiKey = useCallback((tid?: string): string | null => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const targetId = tid || tableId;
    if (!targetId) return null;
    return window.localStorage.getItem(`coin_api_key_${targetId}`) || window.localStorage.getItem('coin_active_api_key');
  }, [tableId]);

  // Helper: Store new API key in localStorage
  const setApiKey = useCallback((key: string, tid?: string) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const targetId = tid || tableId;
    if (targetId) {
      window.localStorage.setItem(`coin_api_key_${targetId}`, key);
    }
    window.localStorage.setItem('coin_active_api_key', key);
    setApiKeyState(key);
  }, [tableId]);

  // Read stored key on mount / tableId change
  useEffect(() => {
    const key = getStoredApiKey();
    setApiKeyState(key);
  }, [getStoredApiKey]);

  // Add audit log helper
  const pushAuditLog = useCallback((item: Omit<AuditLogItem, 'id' | 'timestamp'>) => {
    const newLog: AuditLogItem = {
      ...item,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setAuditLogs((prev) => [newLog, ...prev].slice(0, 50));
  }, []);

  // 1. Drain offline pending queue
  const forceSyncPending = useCallback(async () => {
    const activeKey = apiKey || getStoredApiKey();
    if (!activeKey) {
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
            });
          }

          if (evt.seqNumber && evt.seqNumber > maxSeq) {
            maxSeq = evt.seqNumber;
          }
        }

        setLastSeqNumber(maxSeq);
      }

      setStatus('connected');
    } catch (err) {
      console.warn('Failed to drain pending sync queue:', err);
      setStatus('error');
    }
  }, [apiKey, getStoredApiKey, lastSeqNumber, db, pushAuditLog]);

  // Listen for CSV import / key update sync requests
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleSyncRequest = (e: any) => {
      const detail = e.detail || {};
      const key = detail.apiKey || getStoredApiKey(detail.tableId);
      if (key) {
        setApiKeyState(key);
        if (detail.lastEventSeq !== undefined) {
          setLastSeqNumber(detail.lastEventSeq);
        }
        setTimeout(() => {
          forceSyncPending();
        }, 100);
      }
    };

    window.addEventListener('coin_sync_requested', handleSyncRequest);
    return () => {
      window.removeEventListener('coin_sync_requested', handleSyncRequest);
    };
  }, [getStoredApiKey, forceSyncPending]);

  // 2. Open Real-Time SSE Connection
  useEffect(() => {
    const activeKey = apiKey || getStoredApiKey();
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !activeKey || !window.EventSource) {
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
            setLastSeqNumber(payload.seqNumber);
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
          });
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
  }, [apiKey, getStoredApiKey, forceSyncPending, db, pushAuditLog]);

  // 3. Undo audit log event
  const undoAuditLog = useCallback(async (logId: string) => {
    const targetLog = auditLogs.find((l) => l.id === logId);
    if (!targetLog) return;

    for (const rid of targetLog.rowIds) {
      if (rid) {
        db.deleteRow(rid);
      }
    }

    setAuditLogs((prev) => prev.filter((l) => l.id !== logId));
  }, [auditLogs, db]);

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
