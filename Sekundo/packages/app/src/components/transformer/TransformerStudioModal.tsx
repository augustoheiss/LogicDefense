/**
 * Component: TransformerStudioModal
 *
 * Metamorphic Studio interface for Sekundo events:
 * 1. Choose custom fields/columns to store in CSV and tree metadata.
 * 2. Toggle on-demand mathematical laws from any built-in universal engine.
 * 3. View live metric rollups and operational alerts in real time.
 * 4. Export customized CSV reflecting exactly the user's schema.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import {
  type EventState,
  type SkeletonNode,
  type TransformerConfig,
  type TransformerMathModuleId,
  TRANSFORMER_MATH_MODULES,
  CATALOG_STANDARD_FIELDS,
  DEFAULT_TRANSFORMER_CONFIG,
  calculateTransformerMetrics,
  exportGranularCSV,
} from '@sekundo/core';

interface TransformerStudioModalProps {
  visible: boolean;
  onClose: () => void;
  event: EventState;
  onUpdateEventState: (id: string, updated: EventState) => Promise<void>;
  nodes: SkeletonNode[];
}

export function TransformerStudioModal({
  visible,
  onClose,
  event,
  onUpdateEventState,
  nodes,
}: TransformerStudioModalProps) {
  // Current config from event or default
  const initialConfig = useMemo<TransformerConfig>(() => {
    return event.config.transformerConfig || DEFAULT_TRANSFORMER_CONFIG;
  }, [event.config.transformerConfig]);

  const [activeTab, setActiveTab] = useState<'math' | 'columns' | 'results'>('math');
  const [activeMathModules, setActiveMathModules] = useState<TransformerMathModuleId[]>(
    initialConfig.activeMathModules
  );
  const [customFields, setCustomFields] = useState<string[]>(initialConfig.customFields);
  const [newFieldName, setNewFieldName] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Synchronize when initialConfig updates
  React.useEffect(() => {
    if (visible) {
      const cfg = event.config.transformerConfig || DEFAULT_TRANSFORMER_CONFIG;
      setActiveMathModules(cfg.activeMathModules);
      setCustomFields(cfg.customFields);
    }
  }, [visible, event.config.transformerConfig]);

  // Current draft config
  const currentConfig = useMemo<TransformerConfig>(() => {
    return {
      customFields,
      activeMathModules,
      parameters: initialConfig.parameters,
    };
  }, [customFields, activeMathModules, initialConfig.parameters]);

  // Compute live metrics based on active modules
  const liveMetrics = useMemo(() => {
    return calculateTransformerMetrics(nodes, currentConfig);
  }, [nodes, currentConfig]);

  // Toggle Math Module on/off
  const toggleMathModule = (id: TransformerMathModuleId) => {
    if (activeMathModules.includes(id)) {
      setActiveMathModules(activeMathModules.filter((m) => m !== id));
    } else {
      setActiveMathModules([...activeMathModules, id]);
    }
  };

  // Toggle Custom Column on/off
  const toggleField = (key: string) => {
    if (customFields.includes(key)) {
      if (customFields.length > 1) {
        setCustomFields(customFields.filter((f) => f !== key));
      }
    } else {
      setCustomFields([...customFields, key]);
    }
  };

  // Add Freeform Custom Field
  const handleAddNewField = () => {
    const clean = newFieldName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!clean) return;
    if (!customFields.includes(clean)) {
      setCustomFields([...customFields, clean]);
    }
    setNewFieldName('');
  };

  // Save changes to event state
  const handleSaveConfig = async () => {
    const updatedState: EventState = {
      ...event,
      config: {
        ...event.config,
        engineId: 'transformer',
        transformerConfig: currentConfig,
      },
    };
    await onUpdateEventState(event.config.id, updatedState);
    onClose();
  };

  // Export Custom CSV
  const handleExportCustomCSV = () => {
    const csv = exportGranularCSV(nodes, {
      engineId: 'transformer',
      format: 'clean_human',
      delimiter: ';',
      transformerConfig: currentConfig,
    });

    if (Platform.OS === 'web') {
      const filename = `transformer_${event.config.name.toLowerCase().replace(/\s+/g, '_')}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      setCopyFeedback('Download ativo via navegador.');
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.titleIcon}>🎛️</Text>
              <View>
                <Text style={styles.title}>Engine Transformer (Metamórfica)</Text>
                <Text style={styles.subtitle}>
                  Personalize colunas do CSV e ative as Leis Matemáticas das outras engines a qualquer hora.
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveTab('math')}
              style={[styles.tabItem, activeTab === 'math' && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, activeTab === 'math' && styles.tabTextActive]}>
                ⚡ Leis Matemáticas ({activeMathModules.length})
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveTab('columns')}
              style={[styles.tabItem, activeTab === 'columns' && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, activeTab === 'columns' && styles.tabTextActive]}>
                📋 Colunas do CSV ({customFields.length})
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveTab('results')}
              style={[styles.tabItem, activeTab === 'results' && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, activeTab === 'results' && styles.tabTextActive]}>
                📊 Resultados & Alertas ({liveMetrics.alerts.length})
              </Text>
            </Pressable>
          </View>

          {/* Tab Content */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* TAB 1: Math Modules */}
            {activeTab === 'math' && (
              <View>
                <Text style={styles.sectionHeader}>
                  ATIVAR / DESATIVAR MATEMÁTICA DAS OUTRAS ENGINES
                </Text>
                <Text style={styles.sectionDesc}>
                  Você pode ligar e desligar qualquer cálculo matemático a qualquer momento sem perder seus dados.
                </Text>

                <View style={styles.mathGrid}>
                  {TRANSFORMER_MATH_MODULES.map((module) => {
                    const isActive = activeMathModules.includes(module.id);
                    return (
                      <Pressable
                        key={module.id}
                        onPress={() => toggleMathModule(module.id)}
                        style={[
                          styles.mathCard,
                          isActive && styles.mathCardActive,
                        ]}
                      >
                        <View style={styles.mathCardHeader}>
                          <View style={styles.mathHeaderLeft}>
                            <View
                              style={[
                                styles.mathStatusDot,
                                isActive ? styles.dotActive : styles.dotInactive,
                              ]}
                            />
                            <Text style={styles.mathTitle}>{module.name}</Text>
                          </View>
                          <View
                            style={[
                              styles.mathTogglePill,
                              isActive ? styles.pillActive : styles.pillInactive,
                            ]}
                          >
                            <Text style={styles.mathToggleText}>
                              {isActive ? '✓ ATIVA' : 'DESATIVADA'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.mathDesc}>{module.description}</Text>
                        <Text style={styles.mathFormula}>{module.formulaDescription}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* TAB 2: Custom Columns */}
            {activeTab === 'columns' && (
              <View>
                <Text style={styles.sectionHeader}>
                  ESQUEMA DE COLUNAS DO CSV
                </Text>
                <Text style={styles.sectionDesc}>
                  Escolha quais campos você quer guardar no CSV e nos nós. As colunas ativas serão incluídas na exportação limpa.
                </Text>

                {/* Active Fields Pills */}
                <View style={styles.fieldSection}>
                  <Text style={styles.fieldSectionLabel}>Colunas Ativas no Esquema:</Text>
                  <View style={styles.pillsContainer}>
                    {customFields.map((field) => (
                      <Pressable
                        key={field}
                        onPress={() => toggleField(field)}
                        style={styles.activeFieldPill}
                      >
                        <Text style={styles.activeFieldText}>{field}</Text>
                        <Text style={styles.removeFieldCross}>✕</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Add Custom Field */}
                <View style={styles.addFieldBox}>
                  <Text style={styles.fieldSectionLabel}>Criar Campo Personalizado Livre:</Text>
                  <View style={styles.addFieldRow}>
                    <TextInput
                      style={styles.addInput}
                      placeholder="Ex: veiculo, orcamento, cliente, pontuacao..."
                      placeholderTextColor="#475569"
                      value={newFieldName}
                      onChangeText={setNewFieldName}
                      onSubmitEditing={handleAddNewField}
                    />
                    <Pressable
                      onPress={handleAddNewField}
                      disabled={!newFieldName.trim()}
                      style={[
                        styles.addBtn,
                        !newFieldName.trim() && styles.btnDisabled,
                      ]}
                    >
                      <Text style={styles.addBtnText}>+ Adicionar Coluna</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Catalog Suggested Fields */}
                <View style={styles.fieldSection}>
                  <Text style={styles.fieldSectionLabel}>Catálogo de Campos Sugeridos das Engines:</Text>
                  <View style={styles.pillsContainer}>
                    {CATALOG_STANDARD_FIELDS.map((catalogField) => {
                      const isSelected = customFields.includes(catalogField.key);
                      return (
                        <Pressable
                          key={catalogField.key}
                          onPress={() => toggleField(catalogField.key)}
                          style={[
                            styles.catalogPill,
                            isSelected && styles.catalogPillSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.catalogText,
                              isSelected && styles.catalogTextSelected,
                            ]}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {catalogField.label} ({catalogField.key})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* TAB 3: Results & Alerts */}
            {activeTab === 'results' && (
              <View>
                <Text style={styles.sectionHeader}>
                  MÉTRICAS & ALERTAS OPERACIONAIS EM TEMPO REAL
                </Text>
                <Text style={styles.sectionDesc}>
                  Calculadas dinamicamente com base nas {activeMathModules.length} leis matemáticas ativas.
                </Text>

                {/* Badges Grid */}
                <View style={styles.badgesGrid}>
                  {liveMetrics.summaryBadges.map((badge) => (
                    <View key={badge.id} style={styles.badgeCard}>
                      <Text style={styles.badgeLabel}>{badge.label}</Text>
                      <Text style={[styles.badgeValue, badge.color ? { color: badge.color } : null]}>
                        {badge.value}
                      </Text>
                      {badge.sublabel && (
                        <Text style={styles.badgeSublabel}>{badge.sublabel}</Text>
                      )}
                    </View>
                  ))}
                </View>

                {/* Alerts List */}
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.fieldSectionLabel}>
                    Alertas & Diagnósticos ({liveMetrics.alerts.length}):
                  </Text>
                  {liveMetrics.alerts.length === 0 ? (
                    <View style={styles.noAlertsBox}>
                      <Text style={styles.noAlertsText}>
                        ✓ Nenhuma inconformidade matemática detectada. Todas as Leis ativas estão em conformidade!
                      </Text>
                    </View>
                  ) : (
                    liveMetrics.alerts.map((alert) => (
                      <View
                        key={alert.id}
                        style={[
                          styles.alertCard,
                          alert.level === 'critical'
                            ? styles.alertCritical
                            : alert.level === 'warning'
                            ? styles.alertWarning
                            : styles.alertInfo,
                        ]}
                      >
                        <Text style={styles.alertTitle}>
                          {alert.level === 'critical' ? '🚨 ' : alert.level === 'warning' ? '⚠️ ' : 'ℹ️ '}
                          {alert.title}
                        </Text>
                        <Text style={styles.alertMsg}>{alert.message}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <Pressable onPress={handleExportCustomCSV} style={styles.exportCustomBtn}>
                <Text style={styles.exportCustomText}>📥 Baixar CSV com este Esquema</Text>
              </Pressable>
              {copyFeedback && (
                <Text style={styles.feedbackText}>{copyFeedback}</Text>
              )}
            </View>

            <View style={styles.footerRight}>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleSaveConfig} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Salvar Configuração</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '90%',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  titleIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 16,
  },
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#60A5FA',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#93C5FD',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 16,
  },
  mathGrid: {
    gap: 10,
  },
  mathCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
  },
  mathCardActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  mathCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mathHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mathStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#10B981',
  },
  dotInactive: {
    backgroundColor: '#475569',
  },
  mathTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  mathTogglePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  pillInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mathToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  mathDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  mathFormula: {
    fontSize: 11,
    color: '#38BDF8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fieldSection: {
    marginBottom: 20,
  },
  fieldSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeFieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeFieldText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#93C5FD',
  },
  removeFieldCross: {
    fontSize: 10,
    color: '#93C5FD',
  },
  addFieldBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 20,
  },
  addFieldRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 13,
  },
  addBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 6,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  catalogPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  catalogPillSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  catalogText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  catalogTextSelected: {
    color: '#34D399',
    fontWeight: '600',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgeCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 12,
  },
  badgeLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
    fontWeight: '500',
  },
  badgeValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  badgeSublabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
  },
  noAlertsBox: {
    padding: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  noAlertsText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '500',
  },
  alertCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  alertCritical: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  alertWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  alertInfo: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  alertMsg: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportCustomBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  exportCustomText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackText: {
    color: '#10B981',
    fontSize: 11,
  },
  footerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
