/**
 * Page: skeleton-editor
 *
 * Interactive visual console that renders the recursive TreeView editor.
 * Provides controls for adding sibling/child nodes, editing values, and exporting to CSV.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { TreeView } from '../components/ui/TreeView';
import { GranularExportModal } from '../components/csv/GranularExportModal';
import { TransformerStudioModal } from '../components/transformer/TransformerStudioModal';
import { serializeCSV, engineRegistry, pathKey } from '@sekundo/core';
import type { NodeType, SkeletonNode } from '@sekundo/core';

export default function SkeletonEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events, updateEventState } = useLocalEvent();
  const event = events.find((e) => e.config.id === eventId);

  const { flatRegistry, tree, loading, addNode, updateNode, deleteNode } = useSkeleton(eventId);

  // Engine & Metrics
  const engine = engineRegistry.get(event?.config?.engineId);
  const metrics = engine.calculateMetrics(tree, event?.config);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [transformerModalVisible, setTransformerModalVisible] = useState(false);
  const [editingNode, setEditingNode] = useState<SkeletonNode | null>(null);
  const [parentKey, setParentKey] = useState<string | null>(null);

  // Form Fields
  const [nodeKey, setNodeKey] = useState('');
  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeType, setNodeType] = useState<NodeType>('slot');
  const [nodeValue, setNodeValue] = useState('');
  const [nodeEmail, setNodeEmail] = useState('');

  if (loading || !event) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  const openAddChildModal = (parent: string) => {
    setParentKey(parent);
    setEditingNode(null);
    setNodeKey(`${parent}-01`);
    setNodeLabel('');
    setNodeType('slot');
    setNodeValue('');
    setNodeEmail('');
    setModalVisible(true);
  };

  const openAddRootModal = () => {
    setParentKey(null);
    setEditingNode(null);
    setNodeKey('01');
    setNodeLabel('');
    setNodeType('header');
    setNodeValue('');
    setNodeEmail('');
    setModalVisible(true);
  };

  const openEditModal = (node: SkeletonNode) => {
    setEditingNode(node);
    setParentKey(null);
    setNodeKey(node.key);
    setNodeLabel(node.label);
    setNodeType(node.type);
    setNodeValue(node.value);
    setNodeEmail(node.email);
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      if (editingNode) {
        // Update existing node
        await updateNode(editingNode.key, {
          label: nodeLabel,
          type: nodeType,
          value: nodeValue,
          email: nodeEmail,
        });
      } else {
        // Add new node
        await addNode(nodeKey, nodeType, nodeLabel, nodeValue, nodeEmail, {});
      }
      setModalVisible(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save node.');
    }
  };

  const handleExportCSV = async () => {
    try {
      const csvRows = flatRegistry.map((item) => ({
        _key: item.key,
        _type: item.type,
        label: item.label,
        value: item.value,
        email: item.email,
        _meta_json: Object.keys(item.meta).length > 0 ? JSON.stringify(item.meta) : '',
      }));
      const csvContent = serializeCSV(csvRows);
      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${event.config.name.replace(/\s+/g, '_')}_skeleton.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Native mobile sharing placeholder
        alert('CSV Export is fully configured for Web. Sharing to files is active.');
      }
    } catch (err: any) {
      alert('Failed to export CSV: ' + err.message);
    }
  };

  const handleToggleWork = async (nodeKey: string, newStatus: 0 | 1) => {
    const target = flatRegistry.find((n) => pathKey.equals(n.key, nodeKey));
    const currentMeta = (target?.meta || {}) as Record<string, unknown>;
    await updateNode(nodeKey, {
      value: newStatus === 1 ? 'Trabalhado' : '',
      meta: {
        ...currentMeta,
        worked: newStatus,
        lastWorkedAt: new Date().toISOString(),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header bar */}
      <View style={styles.actionBar}>
        <View style={styles.actionLeft}>
          <Pressable onPress={() => router.replace('/')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Dashboard</Text>
          </Pressable>
          <Text style={styles.eventTitle}>{event.config.name}</Text>
        </View>
        <View style={styles.actionRight}>
          <Pressable onPress={openAddRootModal} style={styles.primaryActionBtn}>
            <Text style={styles.primaryActionBtnText}>+ Add Root</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/pdf-forms?id=${eventId}`)}
            style={[styles.actionBtn, { borderColor: '#FFB800' }]}
          >
            <Text style={[styles.actionBtnText, { color: '#FFB800' }]}>📄 Formulários PDF</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/pdf-mapper?id=${eventId}`)}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnText}>PDF Map</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/p2p-sync?id=${eventId}&role=admin`)}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnText}>Sync & Chat</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/csv-import?id=${eventId}`)}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnText}>Import CSV</Text>
          </Pressable>
          <Pressable
            onPress={() => setExportModalVisible(true)}
            style={[styles.actionBtn, { borderColor: '#10B981' }]}
          >
            <Text style={[styles.actionBtnText, { color: '#10B981' }]}>📤 Exportar CSV (LEGO)</Text>
          </Pressable>
          <Pressable
            onPress={() => setTransformerModalVisible(true)}
            style={[styles.actionBtn, { borderColor: '#8B5CF6' }]}
          >
            <Text style={[styles.actionBtnText, { color: '#C4B5FD' }]}>🎛️ Transformer Studio</Text>
          </Pressable>
        </View>
      </View>

      {/* Engine Metrics & Universal Law Context Bar */}
      <View style={styles.engineBar}>
        <View style={styles.engineBarLeft}>
          <View style={styles.engineBadge}>
            <Text style={styles.engineBadgeText}>{engine.name}</Text>
          </View>
          {metrics.engineId === 'territory_logistics' && (
            <Text style={styles.metricsSummary}>
              Cobertura: {metrics.data.coveragePercent}% ({metrics.data.workedUnits}/{metrics.data.totalUnits} trabalhados) • {metrics.data.quadrasCount} quadras
            </Text>
          )}
          {metrics.engineId === 'study_synthesis' && (
            <Text style={styles.metricsSummary}>
              Sínteses: {metrics.data.completionPercent}% ({metrics.data.submittedCount}/{metrics.data.totalTopics} concluídos)
            </Text>
          )}
          {metrics.engineId === 'roster_assignments' && (
            <Text style={styles.metricsSummary}>
              Preenchimento: {metrics.data.fulfillmentPercent}% ({metrics.data.assignedSlots}/{metrics.data.totalSlots} designados • {metrics.data.confirmedSlots} confirmados)
            </Text>
          )}
          {metrics.engineId === 'incident_command' && (
            <Text style={styles.metricsSummary}>
              ICS: {metrics.data.totalUnits} unidades • {metrics.data.totalPersonnel} efetivo • {metrics.data.spanOfControlBreaches > 0 ? `⚠️ ${metrics.data.spanOfControlBreaches} Sobrecargas de Graicunas` : '✅ Amplitude Saudável'}
            </Text>
          )}
          {metrics.engineId === 'live_production_ros' && (
            <Text style={styles.metricsSummary}>
              Run-of-Show: Drift {metrics.data.cumulativeDriftSec > 0 ? `+${metrics.data.cumulativeDriftSec}s` : `${metrics.data.cumulativeDriftSec}s`} • {metrics.data.hardOutThreatened ? '⚠️ HARD_OUT Ameaçado!' : '✅ No Horário'}
            </Text>
          )}
          {metrics.engineId === 'tournament_pairings' && (
            <Text style={styles.metricsSummary}>
              Torneio: Rodada {metrics.data.currentRound}/{metrics.data.totalRounds} • {metrics.data.completedMatches} partidas • {metrics.data.rematchesDetected > 0 ? `⚠️ ${metrics.data.rematchesDetected} Revanches` : '✅ Sem Revanches'}
            </Text>
          )}
          {metrics.engineId === 'canvassing_logistics' && (
            <Text style={styles.metricsSummary}>
              Canvassing: {metrics.data.contactRatePercent}% contato • {metrics.data.contactedCount} atendidos / {metrics.data.totalDoors} portas
            </Text>
          )}
          {metrics.engineId === 'transformer' && (
            <Text style={styles.metricsSummary}>
              Transformer: {metrics.data.activeModules.length} leis ativas • {metrics.data.alerts.length > 0 ? `⚠️ ${metrics.data.alerts.length} alertas` : '✅ Sem alertas'}
            </Text>
          )}
        </View>

        {metrics.engineId === 'territory_logistics' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => router.push(`/territory-checklist?id=${eventId}`)}
              style={styles.summaryBtn}
            >
              <Text style={styles.summaryBtnText}>📋 Prancheta de Campo</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/territory-map?id=${eventId}`)}
              style={[
                styles.summaryBtn,
                { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' },
              ]}
            >
              <Text style={[styles.summaryBtnText, { color: '#60A5FA' }]}>🗺️ Mapa Tático</Text>
            </Pressable>
          </View>
        )}

        {metrics.engineId === 'canvassing_logistics' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => router.push(`/territory-checklist?id=${eventId}`)}
              style={styles.summaryBtn}
            >
              <Text style={styles.summaryBtnText}>📋 Prancheta 8-Codes</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/territory-map?id=${eventId}`)}
              style={[
                styles.summaryBtn,
                { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' },
              ]}
            >
              <Text style={[styles.summaryBtnText, { color: '#60A5FA' }]}>🗺️ Rota eLOT</Text>
            </Pressable>
          </View>
        )}

        {metrics.engineId === 'study_synthesis' && (
          <Pressable
            onPress={() => setSummaryModalVisible(true)}
            style={styles.summaryBtn}
          >
            <Text style={styles.summaryBtnText}>📖 Resumo Executivo</Text>
          </Pressable>
        )}

        {metrics.engineId === 'roster_assignments' && (
          <Pressable
            onPress={() => router.push(`/roster-swap?id=${eventId}`)}
            style={[
              styles.summaryBtn,
              { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' },
            ]}
          >
            <Text style={[styles.summaryBtnText, { color: '#6EE7B7' }]}>🔄 Reservas & Trocas</Text>
          </Pressable>
        )}

        {metrics.engineId === 'live_production_ros' && (
          <Pressable
            onPress={() => router.push(`/run-of-show?id=${eventId}`)}
            style={[
              styles.summaryBtn,
              { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#EF4444' },
            ]}
          >
            <Text style={[styles.summaryBtnText, { color: '#FCA5A5' }]}>⏱️ Mesa de Corte (ROS)</Text>
          </Pressable>
        )}

        {metrics.engineId === 'tournament_pairings' && (
          <Pressable
            onPress={() => router.push(`/tournament-bracket?id=${eventId}`)}
            style={[
              styles.summaryBtn,
              { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' },
            ]}
          >
            <Text style={[styles.summaryBtnText, { color: '#FCD34D' }]}>🏆 Chaves & Suíço</Text>
          </Pressable>
        )}

        {metrics.engineId === 'incident_command' && (
          <Pressable
            onPress={() => router.push(`/ics-command?id=${eventId}`)}
            style={[
              styles.summaryBtn,
              { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' },
            ]}
          >
            <Text style={[styles.summaryBtnText, { color: '#93C5FD' }]}>🛡️ Comando ICS</Text>
          </Pressable>
        )}

        {metrics.engineId === 'transformer' && (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {metrics.data.summaryBadges.map((b) => (
              <View
                key={b.id}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: b.color ? `${b.color}22` : 'rgba(139, 92, 246, 0.2)',
                  borderWidth: 1,
                  borderColor: b.color || '#8B5CF6',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: b.color || '#C4B5FD',
                  }}
                >
                  {b.label}: {b.value}
                </Text>
              </View>
            ))}
            <Pressable
              onPress={() => setTransformerModalVisible(true)}
              style={[
                styles.summaryBtn,
                { backgroundColor: 'rgba(139, 92, 246, 0.2)', borderColor: '#8B5CF6' },
              ]}
            >
              <Text style={[styles.summaryBtnText, { color: '#C4B5FD' }]}>🎛️ Leis & Colunas</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Skeletons recursive tree renderer */}
      <ScrollView style={styles.treeScroll}>
        <View style={styles.treeWrapper}>
          {tree.length === 0 ? (
            <View style={styles.emptyTreeCard}>
              <Text style={styles.emptyTreeTitle}>This Event Template is Empty</Text>
              <Text style={styles.emptyTreeSub}>
                Add your first root node or import a structured CSV file.
              </Text>
            </View>
          ) : (
            <TreeView
              nodes={tree}
              engineId={event.config.engineId}
              onAddChild={openAddChildModal}
              onEditNode={openEditModal}
              onDeleteNode={deleteNode}
              onToggleWork={handleToggleWork}
            />
          )}
        </View>
      </ScrollView>

      {/* Add / Edit Node Modal */}
      <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingNode ? 'Edit Node' : 'Add Node'}</Text>
            
            {/* Key Field (read-only if editing, configurable if new) */}
            <Text style={styles.inputLabel}>PATH KEY ADDRESS</Text>
            <TextInput
              style={[styles.input, editingNode && styles.inputReadOnly]}
              value={nodeKey}
              onChangeText={setNodeKey}
              editable={!editingNode}
              placeholder="e.g. 01-01-01"
              placeholderTextColor="#4F5E74"
            />

            <Text style={styles.inputLabel}>LABEL NAME</Text>
            <TextInput
              style={styles.input}
              value={nodeLabel}
              onChangeText={setNodeLabel}
              placeholder="e.g. Presidente"
              placeholderTextColor="#4F5E74"
            />

            <Text style={styles.inputLabel}>NODE TYPE</Text>
            <View style={styles.typeSelectorRow}>
              {(['header', 'slot', 'territory', 'note'] as NodeType[]).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setNodeType(type)}
                  style={[styles.typeBtn, nodeType === type && styles.typeBtnActive]}
                >
                  <Text style={[styles.typeBtnText, nodeType === type && styles.typeBtnTextActive]}>
                    {type.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>ASSIGNED VALUE (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={nodeValue}
              onChangeText={setNodeValue}
              placeholder="e.g. Irmão Silva"
              placeholderTextColor="#4F5E74"
            />

            <Text style={styles.inputLabel}>EMAIL DISPATCH (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={nodeEmail}
              onChangeText={setNodeEmail}
              placeholder="e.g. silva@email.com"
              placeholderTextColor="#4F5E74"
              keyboardType="email-address"
            />

            {/* Modal Controls */}
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!nodeKey.trim() || !nodeLabel.trim()}
                style={[styles.modalSaveBtn, (!nodeKey.trim() || !nodeLabel.trim()) && styles.modalSaveDisabled]}
              >
                <Text style={styles.modalSaveBtnText}>Save Changes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Executive Summary Modal for Study Synthesis Engine */}
      <Modal
        animationType="fade"
        transparent
        visible={summaryModalVisible}
        onRequestClose={() => setSummaryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.summaryModalCard]}>
            <View style={styles.summaryModalHeader}>
              <Text style={styles.modalTitle}>📖 Resumo Executivo Consolidado</Text>
              <Pressable onPress={() => setSummaryModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.summaryScroll}>
              <Text style={styles.summaryText}>
                {metrics.engineId === 'study_synthesis'
                  ? metrics.data.executiveSummary
                  : 'Nenhum resumo disponível para este tipo de evento.'}
              </Text>
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setSummaryModalVisible(false)}
                style={styles.modalSaveBtn}
              >
                <Text style={styles.modalSaveBtnText}>Concluído</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sliced / Granular Export Modal (LEGO) */}
      <GranularExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        flatRegistry={flatRegistry}
        eventName={event?.config?.name || 'Sekundo'}
        engineId={event?.config?.engineId}
        transformerConfig={event?.config?.transformerConfig}
      />

      {/* Transformer Metamorphic Studio Modal */}
      <TransformerStudioModal
        visible={transformerModalVisible}
        onClose={() => setTransformerModalVisible(false)}
        event={event}
        onUpdateEventState={updateEventState}
        nodes={tree}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
  },
  engineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  engineBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  engineBadge: {
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  engineBadgeText: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricsSummary: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '500',
  },
  summaryBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  summaryBtnText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryModalCard: {
    maxWidth: 700,
    maxHeight: '80%',
  },
  summaryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#8A94A6',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryScroll: {
    maxHeight: 400,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  summaryText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 16,
  },
  backBtnText: {
    color: '#8A94A6',
    fontSize: 14,
    fontWeight: '500',
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryActionBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  primaryActionBtnText: {
    color: '#12151C',
    fontWeight: '600',
    fontSize: 13,
  },
  actionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  actionBtnText: {
    color: '#A9B4C5',
    fontSize: 13,
    fontWeight: '500',
  },
  treeScroll: {
    flex: 1,
  },
  treeWrapper: {
    padding: 24,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  emptyTreeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 40,
    alignItems: 'center',
  },
  emptyTreeTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyTreeSub: {
    color: '#6F7E94',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: '#1E232F',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  inputLabel: {
    color: '#8A94A6',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    color: '#FFFFFF',
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  inputReadOnly: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    color: '#6B7280',
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  typeBtnActive: {
    borderColor: '#FFB800',
    backgroundColor: 'rgba(255, 184, 0, 0.06)',
  },
  typeBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A94A6',
  },
  typeBtnTextActive: {
    color: '#FFB800',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  modalCancelBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    color: '#A9B4C5',
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  modalSaveDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalSaveBtnText: {
    color: '#12151C',
    fontWeight: '700',
  },
});
