/**
 * Component: DeltaSyncModal
 *
 * Sovereign Mode 1 Delta Synchronization Hub.
 * Solves the core question:
 * "Eu preciso ficar com o computador ligado se eu quiser sincronizar a planilha com alguém?"
 *
 * In Mode 1:
 * - NO server is needed.
 * - Computer does NOT need to stay on.
 * - Peer A exports the delta token or JSON after work.
 * - Peer B imports the delta token at any time.
 * - reconcileLedgers merges operations attribute-by-attribute using Last-Write-Wins.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { FlatSkeletonEntry, LedgerOperation } from '@sekundo/core';
import { reconcileLedgers, createLedgerOperation } from '@sekundo/core';

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
  const [importInput, setImportInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!visible) return null;

  // Generate delta export payload from flatRegistry
  const generateExportPayload = () => {
    // Generate ledger operations from current registry entries that have worked=1 or custom styles
    const ops: LedgerOperation[] = [];
    const now = new Date().toISOString();
    const deviceId = `sovereign_dev_${eventId.slice(0, 6)}`;

    flatRegistry.forEach((node) => {
      const meta = (node.meta || {}) as Record<string, any>;
      if (meta.worked === 1) {
        ops.push(
          createLedgerOperation(eventId, node.key, 'worked', 1, deviceId, {
            authorName: node.value || meta.workerName || 'Voluntário',
            timestamp: meta.lastWorkedAt || meta.completedAt || now,
          })
        );
      }
      if (meta.pinShape) {
        ops.push(createLedgerOperation(eventId, node.key, 'meta.pinShape', meta.pinShape, deviceId));
      }
      if (meta.pinColor) {
        ops.push(createLedgerOperation(eventId, node.key, 'meta.pinColor', meta.pinColor, deviceId));
      }
      if (meta.customColor) {
        ops.push(createLedgerOperation(eventId, node.key, 'meta.customColor', meta.customColor, deviceId));
      }
      if (meta.polygonExpansion) {
        ops.push(createLedgerOperation(eventId, node.key, 'meta.polygonExpansion', meta.polygonExpansion, deviceId));
      }
      if (meta.perimeter_streets) {
        ops.push(createLedgerOperation(eventId, node.key, 'meta.perimeter_streets', meta.perimeter_streets, deviceId));
      }
    });

    const envelope = {
      protocol: 'SEKUNDO_DELTA_v1',
      eventId,
      exportedAt: now,
      operationsCount: ops.length,
      operations: ops,
    };

    return JSON.stringify(envelope, null, 2);
  };

  const exportPayload = generateExportPayload();

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(exportPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleImport = async () => {
    if (!importInput.trim()) {
      setErrorMessage('Por favor, cole o código ou JSON do log de mudanças recebido.');
      return;
    }

    setProcessing(true);
    setErrorMessage(null);
    setResultMessage(null);

    try {
      let parsed: any;
      try {
        parsed = JSON.parse(importInput.trim());
      } catch {
        throw new Error('Formato inválido. Certifique-se de colar o JSON completo gerado pelo Sekundo.');
      }

      let incomingOps: LedgerOperation[] = [];
      if (Array.isArray(parsed)) {
        incomingOps = parsed;
      } else if (parsed && Array.isArray(parsed.operations)) {
        incomingOps = parsed.operations;
      } else {
        throw new Error('Nenhuma lista de operações encontrada no pacote fornecido.');
      }

      // Reconcile ledgers attribute by attribute (Last-Write-Wins)
      const reconcileResult = reconcileLedgers([], incomingOps, flatRegistry);

      await onSyncApplied(reconcileResult.updatedRegistry);

      setResultMessage(
        `✓ Sucesso! ${reconcileResult.appliedOpsCount} operações aplicadas. ${reconcileResult.conflictsResolvedCount} conciliações automáticas efetuadas. Sua planilha foi atualizada sem sobrescrever suas edições!`
      );
      setImportInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar e conciliar o log de mudanças.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>🔄 Sincronização Assíncrona (Modo 1)</Text>
              <Text style={styles.subtitle}>
                Você NÃO precisa deixar o computador ligado! Troque apenas o log de mudanças.
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Education Callout */}
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>💡 COMO FUNCIONA O MODO 1 (100% SOBERANO):</Text>
            <Text style={styles.calloutText}>
              1. Você compartilha a planilha (link ou arquivo). Pode desligar seu computador imediatamente.{'\n'}
              2. O colega trabalha em campo no aparelho dele (marca casas, quadras, personaliza pins).{'\n'}
              3. Ele exporta o <Text style={{ color: '#FFB800', fontWeight: '700' }}>Log de Mudanças (Delta)</Text> e envia para você no WhatsApp.{'\n'}
              4. Você abre o Sekundo, cola aqui e o sistema mescla tudo automaticamente sem apagar o que você fez!
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
                📤 Exportar Minhas Mudanças
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
                📥 Importar Mudanças do Colega
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={{ gap: 14 }}>
            {tab === 'export' ? (
              <View style={styles.tabContent}>
                <Text style={styles.infoLabel}>
                  Copie o pacote abaixo e envie para quem precisa receber as suas atualizações:
                </Text>
                <TextInput
                  style={styles.payloadBox}
                  multiline
                  editable={false}
                  value={exportPayload}
                />
                <Pressable onPress={handleCopy} style={styles.copyBtn}>
                  <Text style={styles.copyBtnText}>
                    {copied ? '✓ Copiado para a Área de Transferência!' : '📋 Copiar Código Delta (Enviar por WhatsApp / E-mail)'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.tabContent}>
                <Text style={styles.infoLabel}>
                  Cole aqui o código ou JSON do Log de Mudanças que seu colega enviou:
                </Text>
                <TextInput
                  style={styles.inputBox}
                  multiline
                  placeholder="Cole o JSON do log de mudanças aqui..."
                  placeholderTextColor="#6F7E94"
                  value={importInput}
                  onChangeText={setImportInput}
                />

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
    maxWidth: 620,
    maxHeight: '90%',
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
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: '#10B981',
    fontSize: 12,
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
    height: 180,
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
    height: 180,
    textAlignVertical: 'top',
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
