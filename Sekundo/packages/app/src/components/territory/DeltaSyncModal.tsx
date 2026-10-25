/**
 * Component: DeltaSyncModal
 *
 * Sovereign Mode 1 Delta Synchronization Hub (v2).
 * - 100% Local-First, zero server dependency.
 * - Uses persistent unique deviceId + HLC + true mutation timestamps.
 * - Propagates worked=1, worked=0 (unmarks), notes, and manual quadra polygons/buffers.
 * - Supports optional AES-256-GCM passphrase encryption (`SEKUNDO_ENC_DELTA_v2:`) and `.sekundo` file export/import.
 * - Supports LGPD note exclusion toggle and reconciliation preview.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import type { FlatSkeletonEntry, LedgerOperation, ReconcilePreview } from '@sekundo/core';
import {
  reconcileLedgers,
  previewReconcileLedgers,
  synthesizeOpsFromRegistry,
  encodeDeltaEnvelope,
  decodeDeltaEnvelope,
  isEncryptedDeltaEnvelope,
  compareLedgerOperations,
  pathKey,
} from '@sekundo/core';
import {
  getOrCreateDeviceId,
  loadEventLedger,
  saveEventLedger,
} from '../../storage/ledgerStore';

export interface DeltaSyncModalProps {
  visible: boolean;
  eventId: string;
  flatRegistry: FlatSkeletonEntry[];
  onClose: () => void;
  onSyncApplied: (updatedRegistry: FlatSkeletonEntry[]) => Promise<void>;
}

export function DeltaSyncModal({
  visible,
  eventId,
  flatRegistry,
  onClose,
  onSyncApplied,
}: DeltaSyncModalProps) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [copied, setCopied] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('dev_local');
  const [localLedger, setLocalLedger] = useState<LedgerOperation[]>([]);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [excludeNotes, setExcludeNotes] = useState(false);
  const [exportPayload, setExportPayload] = useState('');
  const [opsExportCount, setOpsExportCount] = useState(0);

  const [importInput, setImportInput] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [preview, setPreview] = useState<ReconcilePreview | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      const id = await getOrCreateDeviceId();
      const ledger = await loadEventLedger(eventId);
      if (active) {
        setDeviceId(id);
        setLocalLedger(ledger);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, eventId, flatRegistry]);

  // Build merged operations (persisted ledger + synthesized state preserving real mutation timestamps)
  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      const synthOps = synthesizeOpsFromRegistry(eventId, flatRegistry, deviceId, {
        excludeNotes,
      });
      const byField = new Map<string, LedgerOperation>();
      for (const op of [...synthOps, ...localLedger]) {
        if (excludeNotes && (op.field === 'notes' || op.field === 'meta.notes')) continue;
        const key = `${pathKey.normalize(op.nodeKey)}::${op.field}`;
        const existing = byField.get(key);
        if (!existing || compareLedgerOperations(existing, op) <= 0) {
          byField.set(key, op);
        }
      }
      const mergedOps = Array.from(byField.values());
      const encoded = await encodeDeltaEnvelope(eventId, mergedOps, {
        authorId: deviceId,
        passphrase: exportPassphrase.trim() || undefined,
      });
      if (active) {
        setOpsExportCount(mergedOps.length);
        setExportPayload(encoded);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, eventId, flatRegistry, deviceId, localLedger, exportPassphrase, excludeNotes]);

  // Live preview when importInput or importPassphrase changes
  useEffect(() => {
    if (!visible || tab !== 'import' || !importInput.trim()) {
      setPreview(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const decoded = await decodeDeltaEnvelope(
          importInput,
          importPassphrase.trim() || undefined
        );
        const synthLocal = synthesizeOpsFromRegistry(eventId, flatRegistry, deviceId);
        const combinedLocal = [...synthLocal, ...localLedger];
        const prev = previewReconcileLedgers(combinedLocal, decoded.operations, flatRegistry);
        if (active) {
          setPreview(prev);
          setErrorMessage(null);
        }
      } catch (err: any) {
        if (active) {
          setPreview(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, tab, importInput, importPassphrase, eventId, flatRegistry, deviceId, localLedger]);

  if (!visible) return null;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(exportPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleDownloadFile = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const blob = new Blob([exportPayload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `sekundo-delta-${eventId}-${stamp}.sekundo`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadFile = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sekundo,.json,.txt';
    input.onchange = async (e: any) => {
      const file = e?.target?.files?.[0];
      if (!file) return;
      const text = await file.text();
      setImportInput(text);
    };
    input.click();
  };

  const handleImport = async () => {
    if (!importInput.trim()) {
      setErrorMessage('Por favor, cole o código ou carregue um arquivo .sekundo recebido.');
      return;
    }

    setProcessing(true);
    setErrorMessage(null);
    setResultMessage(null);

    try {
      const decoded = await decodeDeltaEnvelope(
        importInput,
        importPassphrase.trim() || undefined
      );

      const synthLocal = synthesizeOpsFromRegistry(eventId, flatRegistry, deviceId);
      const combinedLocal = [...synthLocal, ...localLedger];

      // Reconcile ledgers attribute by attribute (Last-Write-Wins with HLC + true edit timestamps)
      const reconcileResult = reconcileLedgers(
        combinedLocal,
        decoded.operations,
        flatRegistry
      );

      await saveEventLedger(eventId, reconcileResult.consolidatedLedger);
      setLocalLedger(reconcileResult.consolidatedLedger);
      await onSyncApplied(reconcileResult.updatedRegistry);

      setResultMessage(
        `✓ Sucesso! ${reconcileResult.appliedOpsCount} operações recebidas (${reconcileResult.effectiveChangedKeys.length} nós atualizados, ${reconcileResult.conflictsResolvedCount} conciliações automáticas).`
      );
      setImportInput('');
      setPreview(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar e conciliar o log de mudanças.');
    } finally {
      setProcessing(false);
    }
  };

  const needsImportPass = isEncryptedDeltaEnvelope(importInput);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>🔄 Juntar Marcações de Campo entre Celulares (Delta Sync)</Text>
              <Text style={styles.subtitle}>
                Sem servidor na nuvem • Seu aparelho: {deviceId} • {opsExportCount} casas/alterações registradas
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Education Callout */}
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>💡 PARA QUE SERVE ESTA TELA (EM LINGUAGEM SIMPLES):</Text>
            <Text style={styles.calloutText}>
              • Como o Sekundo funciona 100% no seu aparelho (sem internet/servidor), quando um colega sai no campo e marca casas como <Text style={{ color: '#34D399', fontWeight: '700' }}>✓ Feito</Text> no celular dele, essas marcações ficam só no aparelho dele.{'\n'}
              • <Text style={{ color: '#FFB800', fontWeight: '700' }}>Passo 1 (No celular do colega):</Text> Ele clica em "Copiar Código" ou "Baixar .sekundo" e manda para você no WhatsApp.{'\n'}
              • <Text style={{ color: '#38BDF8', fontWeight: '700' }}>Passo 2 (No seu aparelho):</Text> Você abre a aba "Receber Marcações do Colega", cola o código e o aplicativo junta automaticamente todas as casas trabalhadas sem apagar o que você já fez!{'\n'}
              • <Text style={{ color: '#A7F3D0', fontWeight: '700' }}>Dica:</Text> Se você quer apenas mandar o endereço ou link do Google Maps para alguém visitar, use o botão verde <Text style={{ color: '#4ADE80', fontWeight: '700' }}>📲 Compartilhar</Text> direto no território ou endereço!
            </Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            <Pressable
              onPress={() => {
                setTab('export');
                setErrorMessage(null);
                setResultMessage(null);
              }}
              style={[styles.tabBtn, tab === 'export' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, tab === 'export' && styles.tabBtnTextActive]}>
                📤 1. Enviar Minhas Marcações
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setTab('import');
                setErrorMessage(null);
                setResultMessage(null);
              }}
              style={[styles.tabBtn, tab === 'import' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, tab === 'import' && styles.tabBtnTextActive]}>
                📥 2. Receber Marcações do Colega
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={{ gap: 14 }}>
            {tab === 'export' ? (
              <View style={styles.tabContent}>
                {/* Privacy & Encryption Controls */}
                <View style={styles.optionsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.smallLabel}>🔒 Senha de Criptografia (Opcional — AES-256-GCM):</Text>
                    <TextInput
                      style={styles.passInput}
                      placeholder="Em branco = JSON aberto | Com senha = Token criptografado"
                      placeholderTextColor="#6F7E94"
                      secureTextEntry
                      value={exportPassphrase}
                      onChangeText={setExportPassphrase}
                    />
                  </View>
                  <Pressable
                    onPress={() => setExcludeNotes((v) => !v)}
                    style={[styles.lgpdToggle, excludeNotes && styles.lgpdToggleActive]}
                  >
                    <Text style={styles.lgpdToggleText}>
                      {excludeNotes ? '🛡️ LGPD: Sem Notas' : '📝 Incluindo Notas'}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.infoLabel}>
                  Pacote Delta ({opsExportCount} operações prontas para envio):
                </Text>
                <TextInput
                  style={styles.payloadBox}
                  multiline
                  editable={false}
                  value={exportPayload}
                />
                <View style={styles.actionsRow}>
                  <Pressable onPress={handleCopy} style={[styles.copyBtn, { flex: 1 }]}>
                    <Text style={styles.copyBtnText}>
                      {copied ? '✓ Copiado!' : '📋 Copiar Código Delta'}
                    </Text>
                  </Pressable>
                  {Platform.OS === 'web' && (
                    <Pressable onPress={handleDownloadFile} style={styles.fileBtn}>
                      <Text style={styles.fileBtnText}>💾 Baixar .sekundo</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.tabContent}>
                <View style={styles.importHeaderRow}>
                  <Text style={styles.infoLabel}>
                    Cole o código/JSON ou carregue o arquivo .sekundo enviado pelo colega:
                  </Text>
                  {Platform.OS === 'web' && (
                    <Pressable onPress={handleUploadFile} style={styles.uploadSmallBtn}>
                      <Text style={styles.uploadSmallBtnText}>📂 Carregar Arquivo .sekundo</Text>
                    </Pressable>
                  )}
                </View>

                <TextInput
                  style={styles.inputBox}
                  multiline
                  placeholder="Cole o JSON ou token SEKUNDO_ENC_DELTA_v2:... aqui"
                  placeholderTextColor="#6F7E94"
                  value={importInput}
                  onChangeText={setImportInput}
                />

                {needsImportPass && (
                  <View>
                    <Text style={styles.smallLabel}>🔑 Este pacote está criptografado. Digite a senha:</Text>
                    <TextInput
                      style={styles.passInput}
                      placeholder="Senha do pacote Delta..."
                      placeholderTextColor="#6F7E94"
                      secureTextEntry
                      value={importPassphrase}
                      onChangeText={setImportPassphrase}
                    />
                  </View>
                )}

                {preview && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewTitle}>🔍 Prévia da Conciliação:</Text>
                    <Text style={styles.previewText}>
                      • Operações no pacote: {preview.incomingOpsCount}{'\n'}
                      • Nós que mudarão efetivamente na sua planilha: {preview.effectiveChangedKeys.length}{'\n'}
                      • Conflitos resolvidos por HLC / carimbo real: {preview.conflictsCount}
                    </Text>
                  </View>
                )}

                {errorMessage ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                  </View>
                ) : null}

                {resultMessage ? (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>{resultMessage}</Text>
                  </View>
                ) : null}

                <Pressable onPress={handleImport} disabled={processing} style={styles.importBtn}>
                  {processing ? (
                    <ActivityIndicator color="#062016" size="small" />
                  ) : (
                    <Text style={styles.importBtnText}>🔄 Conciliar e Atualizar Minha Planilha Agora</Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.closeFooterBtn}>
              <Text style={styles.closeFooterBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 650,
    maxHeight: '92%',
    backgroundColor: '#161A24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#10B981',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#8A94A6',
    fontSize: 18,
    fontWeight: '700',
  },
  callout: {
    backgroundColor: 'rgba(255, 184, 0, 0.06)',
    borderLeftWidth: 3,
    borderLeftColor: '#FFB800',
    padding: 12,
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: 6,
  },
  calloutTitle: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  calloutText: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  tabBtnText: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 18,
  },
  tabContent: {
    gap: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  smallLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  passInput: {
    backgroundColor: '#0F1219',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    color: '#FFFFFF',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  lgpdToggle: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  lgpdToggleActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: '#10B981',
  },
  lgpdToggleText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  infoLabel: {
    color: '#A0AEC0',
    fontSize: 12,
  },
  payloadBox: {
    backgroundColor: '#0F1219',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#60A5FA',
    fontFamily: 'monospace',
    fontSize: 11,
    padding: 12,
    height: 150,
    textAlignVertical: 'top',
  },
  inputBox: {
    backgroundColor: '#0F1219',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: 12,
    height: 140,
    textAlignVertical: 'top',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  copyBtn: {
    backgroundColor: '#FFB800',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyBtnText: {
    color: '#062016',
    fontSize: 13,
    fontWeight: '800',
  },
  fileBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileBtnText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  importHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  uploadSmallBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  uploadSmallBtnText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  previewBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 8,
    padding: 10,
  },
  previewTitle: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 3,
  },
  previewText: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
  },
  importBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  importBtnText: {
    color: '#062016',
    fontSize: 13,
    fontWeight: '800',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10B981',
    padding: 10,
    borderRadius: 8,
  },
  successText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  closeFooterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  closeFooterBtnText: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '600',
  },
});
