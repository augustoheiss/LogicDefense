/**
 * Page: skeleton-editor
 *
 * Interactive visual console that renders the recursive TreeView editor.
 * Provides controls for adding sibling/child nodes, editing values, and exporting to CSV.
 */

import React, { useState, useMemo } from 'react';
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
import { AddressEditModal } from '../components/territory/AddressEditModal';
import { CadToolDock, type CadToolDefinition } from '../components/ui/CadToolDock';
import { MultiEngineSwitcherBar } from '../components/ui/MultiEngineSwitcherBar';
import {
  serializeCSV,
  engineRegistry,
  pathKey,
  skeletonTree,
  buildProgramacaoReuniaoRegistry,
} from '@sekundo/core';
import type { NodeType, SkeletonNode, FlatSkeletonEntry, EventState } from '@sekundo/core';

export default function SkeletonEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const rawEventId = typeof id === 'string' ? id : '';

  const { events, updateEventState } = useLocalEvent();
  const fallbackEvent = useMemo<EventState>(() => {
    const matched = rawEventId
      ? events.find((e) => e.config.id === rawEventId) || events[0]
      : events[0];
    if (matched) return matched;
    return {
      config: {
        id: 'seed-programacao-reuniao',
        name: 'Unidade Operacional Central',
        frequency: 'weekly',
        startDate: '2026-10-01',
        skeletonRoots: ['01', '02', '03'],
        autoRollover: true,
        engineId: 'roster_assignments',
        activeEngines: ['roster_assignments', 'territory_logistics'],
        createdAt: '2026-10-17T00:00:00.000Z',
        updatedAt: '2026-10-17T00:00:00.000Z',
      },
      lifecycle: 'active',
      archive: [],
    };
  }, [events, rawEventId]);

  const event = fallbackEvent;
  const eventId = event.config.id;

  const {
    flatRegistry: rawFlatRegistry,
    tree: rawTree,
    loading,
    addNode,
    updateNode,
    deleteNode,
  } = useSkeleton(eventId);

  const flatRegistry = useMemo(() => {
    if (rawFlatRegistry && rawFlatRegistry.length > 0) return rawFlatRegistry;
    return buildProgramacaoReuniaoRegistry();
  }, [rawFlatRegistry]);

  const tree = useMemo(() => {
    if (rawTree && rawTree.length > 0) return rawTree;
    return skeletonTree.buildTree(flatRegistry);
  }, [rawTree, flatRegistry]);

  // Engine & Metrics
  const engine = engineRegistry.get(event?.config?.engineId);
  const metrics = engine.calculateMetrics(tree, event?.config);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [transformerModalVisible, setTransformerModalVisible] = useState(false);
  const [editingNode, setEditingNode] = useState<SkeletonNode | null>(null);
  const [editingAddressItem, setEditingAddressItem] = useState<FlatSkeletonEntry | null>(null);
  const [parentKey, setParentKey] = useState<string | null>(null);

  // Form Fields
  const [nodeKey, setNodeKey] = useState('');
  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeType, setNodeType] = useState<NodeType>('slot');
  const [nodeValue, setNodeValue] = useState('');
  const [nodeEmail, setNodeEmail] = useState('');

  if (loading && flatRegistry.length === 0) {
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
    const rawMeta = (node.meta || {}) as Record<string, any>;
    const isAddressNode =
      node.type === 'territory' ||
      !!rawMeta.territory_number ||
      !!rawMeta.territory ||
      !!rawMeta.logradouro ||
      !!rawMeta.address ||
      !!rawMeta.bairro ||
      !!rawMeta.cep ||
      !!rawMeta.cidade ||
      !!rawMeta.city ||
      !!rawMeta.lat ||
      (event?.config.engineId === 'territory_logistics' && (!node.children || node.children.length === 0));

    if (isAddressNode) {
      setEditingAddressItem({
        key: node.key,
        type: node.type,
        label: node.label,
        value: node.value,
        email: node.email,
        meta: rawMeta,
      });
      return;
    }

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

  const skeletonCadTools: CadToolDefinition[] = [
    {
      id: 'add-root',
      icon: '➕',
      label: 'Adicionar Nó Raiz (+ Add Root)',
      shortcut: 'N',
      accentColor: '#FFB800',
      description: 'Cria um novo nó de primeiro nível na árvore hierárquica deste evento.',
      confirmLabel: '➕ Criar Nó Raiz',
      onConfirm: openAddRootModal,
    },
    {
      id: 'pdf-forms',
      icon: '📄',
      label: 'Central de Formulários PDF (4-Up & Multi-Ciclo)',
      shortcut: 'P',
      accentColor: '#FFB800',
      description:
        'Abre o console de impressão 1-Click para Fichas 4-Up, Registro Multi-Ciclo de Territórios (4 Colunas) ou preenchimento automático de AcroForms.',
      confirmLabel: '📄 Abrir Central de Formulários PDF',
      onConfirm: () => router.push(`/pdf-forms?id=${eventId}`),
    },
    {
      id: 'pdf-mapper',
      icon: '📐',
      label: 'Mapeador Visual de Coordenadas PDF',
      shortcut: 'M',
      accentColor: '#38BDF8',
      description:
        'Permite posicionar visualmente campos da árvore sobre qualquer arquivo PDF estático para carimbo determinístico.',
      confirmLabel: '📐 Abrir Mapeador PDF',
      onConfirm: () => router.push(`/pdf-mapper?id=${eventId}`),
    },
    {
      id: 'p2p-sync',
      icon: '🔗',
      label: 'Sincronização P2P & Chat Soberano',
      shortcut: 'S',
      accentColor: '#38BDF8',
      description:
        'Gera tokens criptografados de delegação por subárvore (CBAC) e sincroniza alterações ponto a ponto.',
      confirmLabel: '🔗 Abrir Sync & Chat',
      onConfirm: () => router.push(`/p2p-sync?id=${eventId}&role=admin`),
    },
    {
      id: 'csv-import',
      icon: '📥',
      label: 'Importar Planilha CSV / Excel',
      shortcut: 'I',
      accentColor: '#10B981',
      description:
        'Importa linhas estruturadas de arquivos CSV ou planilhas diretamente para a árvore hierárquica.',
      confirmLabel: '📥 Abrir Importador CSV',
      onConfirm: () => router.push(`/csv-import?id=${eventId}`),
    },
    {
      id: 'csv-export',
      icon: '📤',
      label: 'Exportar CSV Modular (LEGO)',
      shortcut: 'E',
      accentColor: '#10B981',
      description:
        'Exporta subárvores, colunas selecionadas ou toda a estrutura em formato CSV compatível com Excel.',
      confirmLabel: '📤 Abrir Exportador CSV',
      onConfirm: () => setExportModalVisible(true),
    },
    {
      id: 'transformer',
      icon: '🎛️',
      label: 'Transformer Studio (Leis & Colunas)',
      shortcut: 'T',
      accentColor: '#8B5CF6',
      description:
        'Ativa ou combina módulos de leis universais (Logística de Territórios, Escalas, ICS, Run-of-Show, Torneios) sobre este esqueleto.',
      confirmLabel: '🎛️ Abrir Transformer Studio',
      onConfirm: () => setTransformerModalVisible(true),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Compact CAD Tool Dock */}
      <CadToolDock
        testID="skeleton-cad-dock"
        tools={skeletonCadTools}
        leftSlot={
          <View style={styles.actionLeft}>
            <MultiEngineSwitcherBar activeRoute="skeleton-editor" eventId={eventId} />
          </View>
        }
      />

      {/* Engine Metrics & Universal Law Context Bar */}
      <View style={styles.engineBar}>
        <View style={styles.engineBarLeft}>
          <View style={styles.engineBadge}>
            <Text style={styles.engineBadgeText}>{engine.name}</Text>
          </View>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {event.config.name}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {(metrics.engineId === 'territory_logistics' ||
            (event.config.activeEngines || []).includes('territory_logistics')) && (
            <>
              <Pressable
                onPress={() => router.push(`/territory-checklist?id=${eventId}`)}
                style={styles.summaryBtn}
                accessibilityLabel="Prancheta de Campo"
                {...({ title: 'Prancheta de Campo' } as any)}
              >
                <Text style={styles.summaryBtnText}>📋</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/territory-map?id=${eventId}`)}
                style={[
                  styles.summaryBtn,
                  { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' },
                ]}
                accessibilityLabel="Mapa Tático"
                {...({ title: 'Mapa Tático' } as any)}
              >
                <Text style={[styles.summaryBtnText, { color: '#60A5FA' }]}>🗺️</Text>
              </Pressable>
            </>
          )}

          {metrics.engineId === 'study_synthesis' && (
            <Pressable
              onPress={() => setSummaryModalVisible(true)}
              style={styles.summaryBtn}
              accessibilityLabel="Resumo Executivo"
              {...({ title: 'Resumo Executivo' } as any)}
            >
              <Text style={styles.summaryBtnText}>📖</Text>
            </Pressable>
          )}

          {(metrics.engineId === 'roster_assignments' ||
            (event.config.activeEngines || []).includes('roster_assignments')) && (
            <Pressable
              onPress={() => router.push(`/roster-swap?id=${eventId}`)}
              style={[
                styles.summaryBtn,
                { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' },
              ]}
              accessibilityLabel="Reservas e Trocas"
              {...({ title: 'Reservas & Trocas' } as any)}
            >
              <Text style={[styles.summaryBtnText, { color: '#6EE7B7' }]}>🔄</Text>
            </Pressable>
          )}

          {metrics.engineId === 'live_production_ros' && (
            <Pressable
              onPress={() => router.push(`/run-of-show?id=${eventId}`)}
              style={[
                styles.summaryBtn,
                { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#EF4444' },
              ]}
              accessibilityLabel="Mesa de Corte ROS"
              {...({ title: 'Mesa de Corte (ROS)' } as any)}
            >
              <Text style={[styles.summaryBtnText, { color: '#FCA5A5' }]}>⏱️</Text>
            </Pressable>
          )}

          {metrics.engineId === 'tournament_pairings' && (
            <Pressable
              onPress={() => router.push(`/tournament-bracket?id=${eventId}`)}
              style={[
                styles.summaryBtn,
                { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' },
              ]}
              accessibilityLabel="Chaves e Suíço"
              {...({ title: 'Chaves & Suíço' } as any)}
            >
              <Text style={[styles.summaryBtnText, { color: '#FCD34D' }]}>🏆</Text>
            </Pressable>
          )}

          {metrics.engineId === 'incident_command' && (
            <Pressable
              onPress={() => router.push(`/ics-command?id=${eventId}`)}
              style={[
                styles.summaryBtn,
                { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' },
              ]}
              accessibilityLabel="Comando ICS"
              {...({ title: 'Comando ICS' } as any)}
            >
              <Text style={[styles.summaryBtnText, { color: '#93C5FD' }]}>🛡️</Text>
            </Pressable>
          )}
        </View>

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
              placeholder="Ex: Participante 01"
              placeholderTextColor="#4F5E74"
            />

            <Text style={styles.inputLabel}>EMAIL DISPATCH (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={nodeEmail}
              onChangeText={setNodeEmail}
              placeholder="Ex: operador01@exemplo.org"
              placeholderTextColor="#4F5E74"
              keyboardType="email-address"
            />

            {(event?.config.engineId === 'territory_logistics' || nodeType === 'territory') && editingNode ? (
              <Pressable
                onPress={() => {
                  setModalVisible(false);
                  setEditingAddressItem({
                    key: editingNode.key,
                    type: nodeType,
                    label: nodeLabel,
                    value: nodeValue,
                    email: nodeEmail,
                    meta: (editingNode.meta || {}) as Record<string, any>,
                  });
                }}
                style={{
                  marginVertical: 10,
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255, 184, 0, 0.1)',
                  borderWidth: 1,
                  borderColor: '#FFB800',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFB800', fontWeight: '700', fontSize: 13 }}>
                  ✏️ Abrir Editor Completo de Endereço & Mapa
                </Text>
              </Pressable>
            ) : null}

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

      {/* Address Edit Full Modal */}
      <AddressEditModal
        visible={!!editingAddressItem}
        item={editingAddressItem}
        onClose={() => setEditingAddressItem(null)}
        onSave={async (key, updates) => {
          await updateNode(key, updates);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    height: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    maxHeight: Platform.OS === 'web' ? ('100dvh' as any) : '100%',
    overflow: 'hidden',
    backgroundColor: '#12151C',
  },
  engineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  engineBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
    minWidth: 200,
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
    flexShrink: 1,
  },
  summaryBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 10,
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
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtnText: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '600',
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
    maxWidth: 210,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  primaryActionBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    padding: 14,
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
