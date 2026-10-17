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
import { DEFAULT_PUBLIC_API_URL } from '../config/publicApiConfig';
import {
  getApiStorageItem,
  setApiStorageItem,
  subscribeCoinSyncRequested,
} from '../services/apiKeyService';

const API_BASE_URL = `${DEFAULT_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/public`;

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

  const apiKeyRef = useRef<string | null>(null);
  const lastSeqRef = useRef<number>(0);
  const eventSourceRef = useRef<any>(null);
  const hasDrainedPendingRef = useRef<boolean>(false);

  // Helper: Read API key from isomorphic storage (localStorage on Web, AsyncStorage on Mobile)
  const getStoredApiKeyAsync = useCallback(async (tid?: string): Promise<string | null> => {
    const targetId = tid || tableId;
    if (!targetId) return null;
    const isRevoked = (await getApiStorageItem(`coin_api_revoked_${targetId}`)) === 'true';
    if (isRevoked) return null;
    const stored = await getApiStorageItem(`coin_api_key_${targetId}`);
    if (stored) {
      apiKeyRef.current = stored;
    }
    return stored;
  }, [tableId]);

  // Helper: Store API key in isomorphic storage for a specific tableId
  const setApiKey = useCallback((key: string, tid?: string) => {
    const targetId = tid || tableId;
    apiKeyRef.current = key;
    setApiKeyState(key);
    if (targetId) {
      setApiStorageItem(`coin_api_key_${targetId}`, key).catch(() => {});
    }
  }, [tableId]);

  // Helper: Get sequence number scoped strictly by tableId
  const getStoredSeqNumberAsync = useCallback(async (tid?: string): Promise<number> => {
    const targetId = tid || tableId;
    if (!targetId) return 0;
    const val = await getApiStorageItem(`coin_last_seq_${targetId}`);
    const parsed = val ? parseInt(val, 10) || 0 : 0;
    lastSeqRef.current = parsed;
    return parsed;
  }, [tableId]);

  // Helper: Save sequence number scoped strictly by tableId
  const saveLastSeqNumber = useCallback((seq: number, tid?: string) => {
    lastSeqRef.current = seq;
    setLastSeqNumber(seq);
    const targetId = tid || tableId;
    if (targetId) {
      setApiStorageItem(`coin_last_seq_${targetId}`, String(seq)).catch(() => {});
    }
  }, [tableId]);

  // Helper: Load audit logs scoped strictly by tableId
  const loadStoredAuditLogsAsync = useCallback(async (tid?: string): Promise<AuditLogItem[]> => {
    const targetId = tid || tableId;
    if (!targetId) return [];
    try {
      const raw = await getApiStorageItem(`coin_audit_events_${targetId}`);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn('Error reading stored audit logs:', err);
      return [];
    }
  }, [tableId]);

  // Helper: Save audit logs scoped strictly by tableId
  const saveAuditLogs = useCallback((logs: AuditLogItem[], tid?: string) => {
    setAuditLogs(logs);
    const targetId = tid || tableId;
    if (targetId) {
      setApiStorageItem(`coin_audit_events_${targetId}`, JSON.stringify(logs)).catch(() => {});
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
      setApiStorageItem(`coin_audit_events_${currentTableId}`, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, [tableId]);

  // Reactive state reset & reload on tableId change
  useEffect(() => {
    hasDrainedPendingRef.current = false;
    if (!tableId) {
      setAuditLogs([]);
      setLastSeqNumber(0);
      setApiKeyState(null);
      apiKeyRef.current = null;
      lastSeqRef.current = 0;
      return;
    }

    let cancelled = false;
    (async () => {
      const [key, seq, logs] = await Promise.all([
        getStoredApiKeyAsync(tableId),
        getStoredSeqNumberAsync(tableId),
        loadStoredAuditLogsAsync(tableId),
      ]);
      if (cancelled) return;
      apiKeyRef.current = key;
      lastSeqRef.current = seq;
      setApiKeyState(key);
      setLastSeqNumber(seq);
      setAuditLogs(logs);
    })();

    return () => {
      cancelled = true;
    };
  }, [tableId, getStoredApiKeyAsync, getStoredSeqNumberAsync, loadStoredAuditLogsAsync]);

  // 1. Drain offline pending queue
  const forceSyncPending = useCallback(async () => {
    const activeKey = (await getStoredApiKeyAsync(tableId)) || apiKeyRef.current || apiKey;
    if (!activeKey || !tableId) {
      hasDrainedPendingRef.current = true;
      setStatus('disconnected');
      return;
    }

    try {
      setStatus('syncing');
      const sinceSeq = await getStoredSeqNumberAsync(tableId);
      const url = `${API_BASE_URL}/sync/pending?api_key=${encodeURIComponent(activeKey)}&since_seq=${sinceSeq}`;
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
        let maxSeq = sinceSeq;
        for (const evt of data.events) {
          if (evt.rows && evt.rows.length > 0) {
            await db.importSpreadsheet({
              rows: evt.rows,
              mode: evt.mode || 'merge',
            });

            const totalValue = evt.rows.reduce((acc: number, r: TableRow) => {
              const rawVal = Math.abs(Number(r.value) || 0);
              const signed = r.entryType === 'expense' || r.entryType === 'partner_out' ? -rawVal : rawVal;
              return acc + signed;
            }, 0);
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
    } finally {
      hasDrainedPendingRef.current = true;
    }
  }, [apiKey, getStoredApiKeyAsync, getStoredSeqNumberAsync, db, pushAuditLog, tableId, saveLastSeqNumber]);

  // Helper: Synchronize active table rows to the local backend RAM
  const pushActiveTableSnapshot = useCallback(async () => {
    const activeKey = (await getStoredApiKeyAsync(tableId)) || apiKeyRef.current || apiKey;
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
            metadata_json: r.metadataJson || '{}',
            period_start: r.periodStart,
            period_end: r.periodEnd,
            monthly_value: r.monthlyValue,
            month_count: r.monthCount,
            ticker: r.ticker,
            quantity: r.quantity,
            unit_price: r.unitPrice,
            custom_values: r.customValues,
          }))
        })
      });
    } catch (err) {
      console.warn('Failed to push table snapshot to backend:', err);
    }
  }, [getStoredApiKeyAsync, tableId, apiKey, activeTable?.rows]);

  // Push snapshot whenever activeTable rows change, AFTER initial offline queue drain completes (SIT-DEF-04)
  useEffect(() => {
    if (!hasDrainedPendingRef.current) return;
    if (activeTable?.rows && activeTable.rows.length > 0) {
      pushActiveTableSnapshot();
    }
  }, [activeTable?.rows, pushActiveTableSnapshot]);

  // Listen for CSV import / key update sync requests across Web & Mobile
  useEffect(() => {
    const unsubscribe = subscribeCoinSyncRequested(async (detail) => {
      const targetTableId = detail.tableId || tableId;
      if (targetTableId && targetTableId !== tableId) return;

      const key = detail.apiKey || (await getStoredApiKeyAsync(targetTableId));
      if (key) {
        apiKeyRef.current = key;
        setApiKeyState(key);
        if (detail.lastEventSeq !== undefined) {
          saveLastSeqNumber(detail.lastEventSeq, targetTableId);
        }
        setTimeout(async () => {
          await forceSyncPending();
          await pushActiveTableSnapshot();
        }, 100);
      }
    });

    return unsubscribe;
  }, [tableId, getStoredApiKeyAsync, saveLastSeqNumber, forceSyncPending, pushActiveTableSnapshot]);

  // 2. Open Real-Time SSE Connection (Web) or Drain Queue on Mount (Mobile & Web)
  useEffect(() => {
    if (!tableId) {
      hasDrainedPendingRef.current = true;
      setStatus('disconnected');
      return;
    }

    let cancelled = false;
    let es: any = null;

    (async () => {
      const activeKey = (await getStoredApiKeyAsync(tableId)) || apiKeyRef.current || apiKey;
      if (cancelled) return;
      if (!activeKey) {
        hasDrainedPendingRef.current = true;
        setStatus('disconnected');
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.EventSource) {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const sseUrl = `${API_BASE_URL}/sync/stream?api_key=${encodeURIComponent(activeKey)}`;
        es = new window.EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          setStatus('connected');
        };

        es.onmessage = (e: any) => {
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

              const totalValue = payload.rows.reduce((acc: number, r: TableRow) => {
                const rawVal = Math.abs(Number(r.value) || 0);
                const signed = r.entryType === 'expense' || r.entryType === 'partner_out' ? -rawVal : rawVal;
                return acc + signed;
              }, 0);
              const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue);

              pushAuditLog({
                origin: payload.rows[0]?.id?.includes('n8n') ? 'whatsapp' : 'python',
                seqNumber: payload.seqNumber || lastSeqRef.current + 1,
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
      }

      // Initial queue drain on connection (Pull-Before-Push), followed by initial snapshot push
      await forceSyncPending();
      if (!cancelled) {
        await pushActiveTableSnapshot();
      }
    })();

    return () => {
      cancelled = true;
      if (es) {
        es.close();
      }
    };
  }, [tableId, apiKey, getStoredApiKeyAsync, forceSyncPending, pushActiveTableSnapshot, db, pushAuditLog, saveLastSeqNumber]);

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

