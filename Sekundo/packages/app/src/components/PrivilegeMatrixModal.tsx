import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  type ParticipantProfile,
  type ParticipantCategory,
  type ParticipantRoleTier,
  type ParticipantStatusFlag,
  type CapabilityDomainId,
  type CapabilityKey,
  ROLE_TIER_LABELS,
  STATUS_FLAG_LABELS,
  ensureParticipantPrivilegeMatrix,
  deriveSummaryTagsFromCapabilities,
  filterParticipantsByMatrixCriteria,
  buildPresetCapabilities,
  getEffectiveCapabilityColumns,
} from '@sekundo/core';

export interface PrivilegeMatrixModalProps {
  visible: boolean;
  onClose: () => void;
  participants: ParticipantProfile[];
  onChangeParticipants: (updated: ParticipantProfile[]) => void;
  onAutoAssignCurrentWeek?: (strictSameCategoryPairing: boolean) => void;
  onAutoAssignAllWeeks?: (strictSameCategoryPairing: boolean) => void;
  lastAutoAssignSummaryText?: string | null;
}

export function PrivilegeMatrixModal({
  visible,
  onClose,
  participants,
  onChangeParticipants,
  onAutoAssignCurrentWeek,
  onAutoAssignAllWeeks,
  lastAutoAssignSummaryText,
}: PrivilegeMatrixModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<ParticipantCategory | 'ALL'>('ALL');
  const [selectedRoleTier, setSelectedRoleTier] = useState<ParticipantRoleTier | 'ALL'>('ALL');
  const [selectedStatusFlag, setSelectedStatusFlag] = useState<ParticipantStatusFlag | 'ALL'>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedDomain, setSelectedDomain] = useState<CapabilityDomainId | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [strictSameCategoryPairing, setStrictSameCategoryPairing] = useState(true);

  // Click-to-reveal panels (Icon-Only principle)
  const [showAddUserBar, setShowAddUserBar] = useState(false);
  const [showAddPrivilegeBar, setShowAddPrivilegeBar] = useState(false);
  const [showFilterBar, setShowFilterBar] = useState(false);

  const [newUserName, setNewUserName] = useState('');
  const [newUserGroup, setNewUserGroup] = useState('Grupo 1');
  const [newUserCategory, setNewUserCategory] = useState<ParticipantCategory>('perfil_a');
  const [newUserTier, setNewUserTier] = useState<ParticipantRoleTier>('operador_base');
  const [newPrivilegeName, setNewPrivilegeName] = useState('');
  const [extraCustomKeys, setExtraCustomKeys] = useState<string[]>([]);

  const normalizedParticipants = useMemo(
    () => participants.map((p, idx) => ensureParticipantPrivilegeMatrix(p, idx)),
    [participants]
  );

  const allEffectiveColumns = useMemo(
    () => getEffectiveCapabilityColumns(normalizedParticipants, extraCustomKeys),
    [normalizedParticipants, extraCustomKeys]
  );

  const customColumnsCount = useMemo(
    () => allEffectiveColumns.filter((c) => c.domainId === 'custom_csv').length,
    [allEffectiveColumns]
  );

  const domainTabs = useMemo(() => {
    const base: Array<{ id: CapabilityDomainId | 'ALL'; icon: string; label: string; color: string }> = [
      { id: 'ALL', icon: '🌐', label: `Todos (${allEffectiveColumns.length})`, color: '#6366F1' },
      { id: 'coordenacao_abertura', icon: '🎙️', label: '1. Coord.', color: '#2563EB' },
      { id: 'bloco_analitico', icon: '📊', label: '2. Bloco 1', color: '#0D9488' },
      { id: 'bloco_praticas_duplas', icon: '🤝', label: '3. Bloco 2', color: '#D97706' },
      { id: 'bloco_operacional_sintese', icon: '⚙️', label: '4. Bloco 3', color: '#BE123C' },
      { id: 'logistica_plenaria_campo', icon: '🔊', label: '5. Logística', color: '#16A34A' },
    ];
    if (customColumnsCount > 0) {
      base.push({
        id: 'custom_csv',
        icon: '✨',
        label: `6. Planilha (${customColumnsCount})`,
        color: '#EC4899',
      });
    }
    return base;
  }, [allEffectiveColumns.length, customColumnsCount]);

  const filteredParticipants = useMemo(() => {
    return filterParticipantsByMatrixCriteria(normalizedParticipants, {
      categories: selectedCategory === 'ALL' ? undefined : [selectedCategory],
      roleTiers: selectedRoleTier === 'ALL' ? undefined : [selectedRoleTier],
      statusFlags: selectedStatusFlag === 'ALL' ? undefined : [selectedStatusFlag],
      groupTag: selectedGroup,
      searchQuery,
    });
  }, [
    normalizedParticipants,
    selectedCategory,
    selectedRoleTier,
    selectedStatusFlag,
    selectedGroup,
    searchQuery,
  ]);

  const visibleColumns = useMemo(() => {
    if (selectedDomain === 'ALL') return allEffectiveColumns;
    const domainFiltered = allEffectiveColumns.filter((c) => c.domainId === selectedDomain);
    // Always keep custom CSV columns visible alongside any selected domain so imported privileges are never hidden
    const customCols = allEffectiveColumns.filter((c) => c.domainId === 'custom_csv');
    if (selectedDomain !== 'custom_csv' && customCols.length > 0) {
      return [...domainFiltered, ...customCols];
    }
    return domainFiltered;
  }, [allEffectiveColumns, selectedDomain]);

  const handleToggleCapability = (participantId: string, capKey: CapabilityKey) => {
    const updated = normalizedParticipants.map((p) => {
      if (p.id !== participantId) return p;
      const nextCaps: Record<string, boolean> = {
        ...(p.capabilities || {}),
        [capKey]: !p.capabilities?.[capKey],
      };
      const nextTags = deriveSummaryTagsFromCapabilities(nextCaps, p.roleTier);
      return {
        ...p,
        capabilities: nextCaps,
        capabilityTags: nextTags,
        preserveExplicitCapabilities: true,
      };
    });
    onChangeParticipants(updated);
  };

  const handleToggleRoleTier = (participantId: string) => {
    const order: ParticipantRoleTier[] = [
      'operador_base',
      'assistente_tecnico',
      'coordenador_senior',
    ];
    const updated = normalizedParticipants.map((p, idx) => {
      if (p.id !== participantId) return p;
      const currentIdx = order.indexOf(p.roleTier || 'operador_base');
      const nextTier = order[(currentIdx + 1) % order.length];
      const nextCaps = p.preserveExplicitCapabilities
        ? { ...(p.capabilities || {}) }
        : buildPresetCapabilities(p.profileCategory || 'perfil_a', nextTier, idx);
      return {
        ...p,
        roleTier: nextTier,
        capabilities: nextCaps,
        capabilityTags: deriveSummaryTagsFromCapabilities(nextCaps, nextTier),
      };
    });
    onChangeParticipants(updated);
  };

  const handleCreateUser = () => {
    const cleanName = newUserName.trim() || `Participante ${normalizedParticipants.length + 1}`;
    const newId = `p-${Date.now().toString().slice(-4)}`;
    const caps = buildPresetCapabilities(
      newUserCategory,
      newUserTier,
      normalizedParticipants.length
    );
    // Ensure custom keys exist as false by default on new user
    for (const col of allEffectiveColumns) {
      if (!(col.key in caps)) {
        (caps as Record<string, boolean>)[col.key] = false;
      }
    }
    const created: ParticipantProfile = {
      id: newId,
      name: cleanName,
      groupTag: newUserGroup,
      profileCategory: newUserCategory,
      roleTier: newUserTier,
      statusFlags: ['integral_regular', 'recem_designado'],
      capabilities: caps,
      capabilityTags: deriveSummaryTagsFromCapabilities(caps, newUserTier),
      assignmentCount: 0,
      lastAssignedIsoDate: '',
      active: true,
      preserveExplicitCapabilities: true,
    };
    onChangeParticipants([...normalizedParticipants, created]);
    setNewUserName('');
    setShowAddUserBar(false);
  };

  const handleCreateCustomPrivilege = () => {
    const cleanKey = newPrivilegeName.trim();
    if (!cleanKey) return;
    setExtraCustomKeys((prev) => (prev.includes(cleanKey) ? prev : [...prev, cleanKey]));
    const updated = normalizedParticipants.map((p) => ({
      ...p,
      capabilities: {
        ...(p.capabilities || {}),
        [cleanKey]: Boolean(p.capabilities?.[cleanKey]),
      },
      preserveExplicitCapabilities: true,
    }));
    onChangeParticipants(updated);
    setNewPrivilegeName('');
    setShowAddPrivilegeBar(false);
  };

  const handleResetRotationLedger = () => {
    const reset = normalizedParticipants.map((p) => ({
      ...p,
      assignmentCount: 0,
      lastAssignedIsoDate: '',
      lastPartnerId: undefined,
    }));
    onChangeParticipants(reset);
  };

  const webTitle = (title: string) => (Platform.OS === 'web' ? ({ title } as any) : {});

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.cadModalContainer}>
          {/* Top Compact Icon-Only CAD Ribbon */}
          <View style={styles.topRibbon}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <Text style={styles.modalTitle}>🛡️ PRIVILÉGIOS</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>
                  {filteredParticipants.length}/{normalizedParticipants.length} 👤 •{' '}
                  {allEffectiveColumns.length} col
                </Text>
              </View>
            </View>

            <View style={styles.topActionsRow}>
              <Pressable
                testID="priv-modal-btn-search"
                accessibilityRole="button"
                accessibilityLabel="Filtrar Usuários"
                {...webTitle('Filtrar Usuários por Nome, Grade, Escalão ou Grupo')}
                style={[styles.iconActionBtn, showFilterBar && styles.cadBtnActive]}
                onPress={() => setShowFilterBar((prev) => !prev)}
              >
                <Text style={styles.iconActionGlyph}>🔍</Text>
              </Pressable>

              <Pressable
                testID="priv-modal-btn-add-user"
                accessibilityRole="button"
                accessibilityLabel="Novo Usuário"
                {...webTitle('Adicionar Novo Usuário')}
                style={[styles.iconActionBtn, showAddUserBar && styles.cadBtnActive]}
                onPress={() => {
                  setShowAddUserBar((prev) => !prev);
                  setShowAddPrivilegeBar(false);
                }}
              >
                <Text style={styles.iconActionGlyph}>➕</Text>
              </Pressable>

              <Pressable
                testID="priv-modal-btn-add-priv"
                accessibilityRole="button"
                accessibilityLabel="Novo Privilégio Customizado"
                {...webTitle('Criar Novo Privilégio Customizado na Planilha')}
                style={[styles.iconActionBtn, showAddPrivilegeBar && styles.cadBtnActive]}
                onPress={() => {
                  setShowAddPrivilegeBar((prev) => !prev);
                  setShowAddUserBar(false);
                }}
              >
                <Text style={styles.iconActionGlyph}>🏷️</Text>
              </Pressable>

              <Pressable
                testID="priv-modal-btn-pairing"
                accessibilityRole="button"
                accessibilityLabel={
                  strictSameCategoryPairing ? 'Duplas: Mesma Grade' : 'Duplas: Misto Livre'
                }
                {...webTitle(
                  strictSameCategoryPairing ? 'Duplas: Mesma Grade (A/B)' : 'Duplas: Misto Livre'
                )}
                style={[
                  styles.iconActionBtn,
                  strictSameCategoryPairing && {
                    borderColor: '#38BDF8',
                    backgroundColor: '#0C4A6E',
                  },
                ]}
                onPress={() => setStrictSameCategoryPairing((prev) => !prev)}
              >
                <Text style={styles.iconActionGlyph}>🔗</Text>
              </Pressable>

              {onAutoAssignCurrentWeek && (
                <Pressable
                  testID="priv-modal-btn-auto-week"
                  accessibilityRole="button"
                  accessibilityLabel="Auto-Designar Semana"
                  {...webTitle('Auto-Designar Semana Atual')}
                  style={[styles.iconActionBtn, styles.cadBtnEmerald]}
                  onPress={() => onAutoAssignCurrentWeek(strictSameCategoryPairing)}
                >
                  <Text style={styles.iconActionGlyph}>⚡</Text>
                </Pressable>
              )}

              {onAutoAssignAllWeeks && (
                <Pressable
                  testID="priv-modal-btn-auto-all"
                  accessibilityRole="button"
                  accessibilityLabel="Auto-Designar 9 Semanas"
                  {...webTitle('Auto-Designar Todas as 9 Semanas')}
                  style={[styles.iconActionBtn, styles.cadBtnGold]}
                  onPress={() => onAutoAssignAllWeeks(strictSameCategoryPairing)}
                >
                  <Text style={styles.iconActionGlyph}>🪄</Text>
                </Pressable>
              )}

              <Pressable
                testID="priv-modal-btn-reset"
                accessibilityRole="button"
                accessibilityLabel="Zerar Rotação"
                {...webTitle('Zerar Contadores de Rotação')}
                style={styles.iconActionBtn}
                onPress={handleResetRotationLedger}
              >
                <Text style={styles.iconActionGlyph}>↺</Text>
              </Pressable>

              <Pressable
                testID="priv-modal-btn-close"
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                {...webTitle('Fechar Matriz de Privilégios')}
                style={[styles.iconActionBtn, styles.cadBtnDanger]}
                onPress={onClose}
              >
                <Text style={[styles.iconActionGlyph, { color: '#FECACA' }]}>✕</Text>
              </Pressable>
            </View>
          </View>

          {lastAutoAssignSummaryText ? (
            <View style={styles.summaryBanner}>
              <Text style={styles.summaryBannerText}>{lastAutoAssignSummaryText}</Text>
            </View>
          ) : null}

          {/* Click-to-Reveal: Add New User Strip */}
          {showAddUserBar && (
            <View style={styles.addUserStrip}>
              <TextInput
                style={styles.addUserInput}
                placeholder="Nome do participante..."
                placeholderTextColor="#64748B"
                value={newUserName}
                onChangeText={setNewUserName}
              />
              {(['Grupo 1', 'Grupo 2', 'Grupo 3'] as const).map((g) => (
                <Pressable
                  key={g}
                  style={[styles.filterChip, newUserGroup === g && styles.filterChipActive]}
                  onPress={() => setNewUserGroup(g)}
                >
                  <Text style={styles.filterChipText}>{g}</Text>
                </Pressable>
              ))}
              {(['perfil_a', 'perfil_b'] as const).map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.filterChip, newUserCategory === cat && styles.filterChipActive]}
                  onPress={() => setNewUserCategory(cat)}
                >
                  <Text style={styles.filterChipText}>
                    {cat === 'perfil_a' ? 'A' : 'B'}
                  </Text>
                </Pressable>
              ))}
              <Pressable style={[styles.cadBtn, styles.cadBtnEmerald]} onPress={handleCreateUser}>
                <Text style={[styles.cadBtnText, { color: '#ECFDF5' }]}>💾</Text>
              </Pressable>
            </View>
          )}

          {/* Click-to-Reveal: Add New Custom Privilege Strip */}
          {showAddPrivilegeBar && (
            <View style={styles.addUserStrip}>
              <TextInput
                style={styles.addUserInput}
                placeholder="Nome de qualquer privilégio (ex: Som_HD, Indicador_B)..."
                placeholderTextColor="#64748B"
                value={newPrivilegeName}
                onChangeText={setNewPrivilegeName}
              />
              <Pressable
                style={[styles.cadBtn, styles.cadBtnEmerald]}
                onPress={handleCreateCustomPrivilege}
              >
                <Text style={[styles.cadBtnText, { color: '#ECFDF5' }]}>🏷️ Criar</Text>
              </Pressable>
            </View>
          )}

          {/* Click-to-Reveal: Multi-Facet Filter Bar */}
          {showFilterBar && (
            <View style={styles.filterRibbon}>
              <TextInput
                style={styles.searchInput}
                placeholder="🔍 Nome/Grupo..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {(['ALL', 'perfil_a', 'perfil_b'] as const).map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={styles.filterChipText}>
                    {cat === 'ALL' ? 'Grades' : cat === 'perfil_a' ? 'Grade A' : 'Grade B'}
                  </Text>
                </Pressable>
              ))}

              {(
                ['ALL', 'coordenador_senior', 'assistente_tecnico', 'operador_base'] as const
              ).map((tier) => (
                <Pressable
                  key={tier}
                  style={[styles.filterChip, selectedRoleTier === tier && styles.filterChipActive]}
                  onPress={() => setSelectedRoleTier(tier)}
                >
                  <Text style={styles.filterChipText}>
                    {tier === 'ALL' ? 'Escalões' : ROLE_TIER_LABELS[tier]}
                  </Text>
                </Pressable>
              ))}

              {(['ALL', 'Grupo 1', 'Grupo 2', 'Grupo 3'] as const).map((grp) => (
                <Pressable
                  key={grp}
                  style={[styles.filterChip, selectedGroup === grp && styles.filterChipActive]}
                  onPress={() => setSelectedGroup(grp)}
                >
                  <Text style={styles.filterChipText}>
                    {grp === 'ALL' ? 'Grupos' : grp}
                  </Text>
                </Pressable>
              ))}

              {(
                [
                  'ALL',
                  'integral_regular',
                  'integral_continuo',
                  'capacitador',
                  'em_qualificacao',
                  'recem_designado',
                ] as const
              ).map((st) => (
                <Pressable
                  key={st}
                  style={[styles.filterChip, selectedStatusFlag === st && styles.filterChipActive]}
                  onPress={() => setSelectedStatusFlag(st)}
                >
                  <Text style={styles.filterChipText}>
                    {st === 'ALL' ? 'Status' : STATUS_FLAG_LABELS[st]}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Compact Domain Selector Tabs */}
          <View style={styles.domainRibbon}>
            {domainTabs.map((tab) => {
              const active = selectedDomain === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[
                    styles.domainTab,
                    active && { backgroundColor: tab.color, borderColor: '#F8FAFC' },
                  ]}
                  onPress={() => setSelectedDomain(tab.id)}
                >
                  <Text style={[styles.domainTabText, active && { color: '#FFFFFF' }]}>
                    {tab.icon} {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Matrix Grid Area */}
          <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ minWidth: '100%' }}>
            <View style={{ flex: 1 }}>
              {/* Sticky Column Headers */}
              <View style={styles.matrixHeaderRow}>
                <View style={styles.participantNameCol}>
                  <Text style={styles.matrixHeaderCellText}>USUÁRIO / GRUPO</Text>
                </View>
                <View style={styles.tierCol}>
                  <Text style={styles.matrixHeaderCellText}>ESCALÃO</Text>
                </View>
                <View style={styles.rotationCol}>
                  <Text style={styles.matrixHeaderCellText}>ROT.</Text>
                </View>
                {visibleColumns.map((col) => (
                  <View
                    key={col.key}
                    style={[styles.capColHeader, { borderTopColor: col.accentColor }]}
                  >
                    <Text style={styles.capColHeaderText} numberOfLines={2}>
                      {col.shortLabel}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Participant Rows */}
              <ScrollView style={{ flex: 1 }}>
                {filteredParticipants.map((p, rowIdx) => (
                  <View
                    key={p.id}
                    style={[
                      styles.matrixRow,
                      rowIdx % 2 === 1 && { backgroundColor: '#0F172A' },
                    ]}
                  >
                    <View style={styles.participantNameCol}>
                      <Text style={styles.participantNameText} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.participantMetaText}>
                        {p.groupTag} • {p.profileCategory === 'perfil_b' ? 'Grade B' : 'Grade A'}
                      </Text>
                    </View>

                    <Pressable
                      style={styles.tierCol}
                      onPress={() => handleToggleRoleTier(p.id)}
                    >
                      <Text style={styles.tierBadgeText} numberOfLines={1}>
                        {ROLE_TIER_LABELS[p.roleTier || 'operador_base']} ↻
                      </Text>
                    </Pressable>

                    <View style={styles.rotationCol}>
                      <Text style={styles.rotationText}>
                        {p.assignmentCount ?? 0}x
                      </Text>
                      <Text style={styles.rotationDateText} numberOfLines={1}>
                        {p.lastAssignedIsoDate ? p.lastAssignedIsoDate.slice(5) : 'Livre'}
                      </Text>
                    </View>

                    {visibleColumns.map((col) => {
                      const enabled = Boolean(p.capabilities?.[col.key]);
                      return (
                        <Pressable
                          key={col.key}
                          testID={`priv-cell-${p.id}-${col.key}`}
                          style={[
                            styles.capCell,
                            enabled && {
                              backgroundColor: `${col.accentColor}33`,
                              borderColor: col.accentColor,
                            },
                          ]}
                          onPress={() => handleToggleCapability(p.id, col.key)}
                        >
                          <Text
                            style={[
                              styles.capCellCheck,
                              enabled ? { color: '#38BDF8' } : { color: '#334155' },
                            ]}
                          >
                            {enabled ? '☑' : '☐'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  cadModalContainer: {
    width: '100%',
    maxWidth: 1260,
    height: '94%',
    backgroundColor: '#090D16',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  topRibbon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 6,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  countPill: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  countPillText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  topActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 7,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionGlyph: {
    fontSize: 15,
    color: '#F8FAFC',
  },
  cadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cadBtnActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#60A5FA',
  },
  cadBtnEmerald: {
    backgroundColor: '#059669',
    borderColor: '#34D399',
  },
  cadBtnGold: {
    backgroundColor: '#F59E0B',
    borderColor: '#FDE68A',
  },
  cadBtnDanger: {
    backgroundColor: '#450A0A',
    borderColor: '#EF4444',
  },
  cadBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  summaryBanner: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#10B981',
  },
  summaryBannerText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '700',
  },
  addUserStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  addUserInput: {
    minWidth: 180,
    flex: 1,
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#F8FAFC',
    fontSize: 12,
  },
  filterRibbon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  searchInput: {
    width: 130,
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: '#F8FAFC',
    fontSize: 11,
  },
  filterChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#93C5FD',
  },
  filterChipText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '600',
  },
  domainRibbon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#090D16',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  domainTab: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  domainTabText: {
    color: '#CBD5E1',
    fontSize: 10.5,
    fontWeight: '700',
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  matrixHeaderCellText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  participantNameCol: {
    width: 165,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
  },
  tierCol: {
    width: 125,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
  },
  rotationCol: {
    width: 58,
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
  },
  capColHeader: {
    width: 86,
    height: 38,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#334155',
    borderTopWidth: 3,
  },
  capColHeaderText: {
    color: '#F8FAFC',
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  matrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  participantNameText: {
    color: '#F8FAFC',
    fontSize: 11.5,
    fontWeight: '700',
  },
  participantMetaText: {
    color: '#64748B',
    fontSize: 9.5,
  },
  tierBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '600',
  },
  rotationText: {
    color: '#FBBF24',
    fontSize: 10.5,
    fontWeight: '800',
  },
  rotationDateText: {
    color: '#64748B',
    fontSize: 9,
  },
  capCell: {
    width: 86,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
  },
  capCellCheck: {
    fontSize: 14,
    fontWeight: '800',
  },
});
