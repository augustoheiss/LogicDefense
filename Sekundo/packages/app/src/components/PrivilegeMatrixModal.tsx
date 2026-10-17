import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  type ParticipantProfile,
  type ParticipantCategory,
  type ParticipantRoleTier,
  type ParticipantStatusFlag,
  type CapabilityDomainId,
  type CapabilityKey,
  CAPABILITY_COLUMNS,
  ROLE_TIER_LABELS,
  PROFILE_CATEGORY_LABELS,
  STATUS_FLAG_LABELS,
  ensureParticipantPrivilegeMatrix,
  deriveSummaryTagsFromCapabilities,
  filterParticipantsByMatrixCriteria,
  buildPresetCapabilities,
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

const DOMAIN_TABS: Array<{ id: CapabilityDomainId | 'ALL'; label: string; color: string }> = [
  { id: 'coordenacao_abertura', label: '1. Coord. & Abertura (2)', color: '#2563EB' },
  { id: 'bloco_analitico', label: '2. Bloco 1 Analítico (3)', color: '#0D9488' },
  { id: 'bloco_praticas_duplas', label: '3. Bloco 2 Práticas/Duplas (5)', color: '#D97706' },
  { id: 'bloco_operacional_sintese', label: '4. Bloco 3 Síntese (4)', color: '#BE123C' },
  { id: 'logistica_plenaria_campo', label: '5. Logística & Plenária (12)', color: '#16A34A' },
  { id: 'ALL', label: 'Todas as 26 Colunas', color: '#6366F1' },
];

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
  const [selectedDomain, setSelectedDomain] = useState<CapabilityDomainId | 'ALL'>(
    'bloco_praticas_duplas'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [strictSameCategoryPairing, setStrictSameCategoryPairing] = useState(true);

  // Inline "New User" form state
  const [showAddUserBar, setShowAddUserBar] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserGroup, setNewUserGroup] = useState('Grupo 1');
  const [newUserCategory, setNewUserCategory] = useState<ParticipantCategory>('perfil_a');
  const [newUserTier, setNewUserTier] = useState<ParticipantRoleTier>('operador_base');

  const normalizedParticipants = useMemo(
    () => participants.map((p, idx) => ensureParticipantPrivilegeMatrix(p, idx)),
    [participants]
  );

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
    if (selectedDomain === 'ALL') return CAPABILITY_COLUMNS;
    return CAPABILITY_COLUMNS.filter((c) => c.domainId === selectedDomain);
  }, [selectedDomain]);

  const handleToggleCapability = (participantId: string, capKey: CapabilityKey) => {
    const updated = normalizedParticipants.map((p) => {
      if (p.id !== participantId) return p;
      const nextCaps = {
        ...(p.capabilities || {}),
        [capKey]: !p.capabilities?.[capKey],
      };
      const nextTags = deriveSummaryTagsFromCapabilities(nextCaps, p.roleTier);
      return {
        ...p,
        capabilities: nextCaps,
        capabilityTags: nextTags,
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
      const nextCaps = buildPresetCapabilities(
        p.profileCategory || 'perfil_a',
        nextTier,
        idx
      );
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
    };
    onChangeParticipants([...normalizedParticipants, created]);
    setNewUserName('');
    setShowAddUserBar(false);
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

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.cadModalContainer}>
          {/* Top AutoCAD Ribbon */}
          <View style={styles.topRibbon}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>
                🛡️ MATRIZ DE PRIVILÉGIOS & AUTO-DESIGNAÇÃO (CLEAN-ROOM CAD)
              </Text>
              <Text style={styles.modalSubtitle}>
                {filteredParticipants.length}/{normalizedParticipants.length} usuários filtrados • 26
                colunas de habilitação • Zero repetição no mesmo dia
              </Text>
            </View>

            <View style={styles.topActionsRow}>
              <Pressable
                style={[styles.cadBtn, showAddUserBar && styles.cadBtnActive]}
                onPress={() => setShowAddUserBar((prev) => !prev)}
              >
                <Text style={styles.cadBtnText}>➕ Novo Usuário</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.cadBtn,
                  strictSameCategoryPairing && { borderColor: '#38BDF8', backgroundColor: '#0C4A6E' },
                ]}
                onPress={() => setStrictSameCategoryPairing((prev) => !prev)}
              >
                <Text style={styles.cadBtnText}>
                  {strictSameCategoryPairing ? '🔗 Duplas: Mesma Grade' : '🔗 Duplas: Misto Livre'}
                </Text>
              </Pressable>

              {onAutoAssignCurrentWeek && (
                <Pressable
                  style={[styles.cadBtn, styles.cadBtnEmerald]}
                  onPress={() => onAutoAssignCurrentWeek(strictSameCategoryPairing)}
                >
                  <Text style={[styles.cadBtnText, { color: '#ECFDF5' }]}>
                    ⚡ Auto-Designar Semana
                  </Text>
                </Pressable>
              )}

              {onAutoAssignAllWeeks && (
                <Pressable
                  style={[styles.cadBtn, styles.cadBtnGold]}
                  onPress={() => onAutoAssignAllWeeks(strictSameCategoryPairing)}
                >
                  <Text style={[styles.cadBtnText, { color: '#0F172A' }]}>
                    ⚡ Auto-Designar 9 Semanas
                  </Text>
                </Pressable>
              )}

              <Pressable style={styles.cadBtn} onPress={handleResetRotationLedger}>
                <Text style={styles.cadBtnText}>↺ Zerar Rotação</Text>
              </Pressable>

              <Pressable style={[styles.cadBtn, styles.cadBtnDanger]} onPress={onClose}>
                <Text style={[styles.cadBtnText, { color: '#FECACA' }]}>✕ Fechar</Text>
              </Pressable>
            </View>
          </View>

          {lastAutoAssignSummaryText ? (
            <View style={styles.summaryBanner}>
              <Text style={styles.summaryBannerText}>{lastAutoAssignSummaryText}</Text>
            </View>
          ) : null}

          {/* Optional Inline Add New User Strip */}
          {showAddUserBar && (
            <View style={styles.addUserStrip}>
              <TextInput
                style={styles.addUserInput}
                placeholder="Nome do novo participante..."
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
                    {cat === 'perfil_a' ? 'Grade A' : 'Grade B'}
                  </Text>
                </Pressable>
              ))}
              {(
                ['operador_base', 'assistente_tecnico', 'coordenador_senior'] as ParticipantRoleTier[]
              ).map((tier) => (
                <Pressable
                  key={tier}
                  style={[styles.filterChip, newUserTier === tier && styles.filterChipActive]}
                  onPress={() => setNewUserTier(tier)}
                >
                  <Text style={styles.filterChipText}>{ROLE_TIER_LABELS[tier]}</Text>
                </Pressable>
              ))}
              <Pressable style={[styles.cadBtn, styles.cadBtnEmerald]} onPress={handleCreateUser}>
                <Text style={[styles.cadBtnText, { color: '#ECFDF5' }]}>💾 Salvar Usuário</Text>
              </Pressable>
            </View>
          )}

          {/* Multi-Facet Filter Bar (5 Dimensions from Clean-Room Specification) */}
          <View style={styles.filterRibbon}>
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Filtrar nome..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {/* Category Filter (Grade A / Grade B) */}
            {(['ALL', 'perfil_a', 'perfil_b'] as const).map((cat) => (
              <Pressable
                key={cat}
                style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={styles.filterChipText}>
                  {cat === 'ALL'
                    ? 'Todas Grades'
                    : cat === 'perfil_a'
                    ? 'Grade A (Coord/Geral)'
                    : 'Grade B (Práticas/Duplas)'}
                </Text>
              </Pressable>
            ))}

            {/* Role Tier Filter */}
            {(
              ['ALL', 'coordenador_senior', 'assistente_tecnico', 'operador_base'] as const
            ).map((tier) => (
              <Pressable
                key={tier}
                style={[styles.filterChip, selectedRoleTier === tier && styles.filterChipActive]}
                onPress={() => setSelectedRoleTier(tier)}
              >
                <Text style={styles.filterChipText}>
                  {tier === 'ALL' ? 'Todos Escalões' : ROLE_TIER_LABELS[tier]}
                </Text>
              </Pressable>
            ))}

            {/* Group Filter */}
            {(['ALL', 'Grupo 1', 'Grupo 2', 'Grupo 3'] as const).map((grp) => (
              <Pressable
                key={grp}
                style={[styles.filterChip, selectedGroup === grp && styles.filterChipActive]}
                onPress={() => setSelectedGroup(grp)}
              >
                <Text style={styles.filterChipText}>
                  {grp === 'ALL' ? 'Todos Grupos' : grp}
                </Text>
              </Pressable>
            ))}

            {/* Status Flag Filter */}
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
                  {st === 'ALL' ? 'Todos Status' : STATUS_FLAG_LABELS[st]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Capability Domain Selector Ribbon */}
          <View style={styles.domainRibbon}>
            {DOMAIN_TABS.map((tab) => {
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
                    {tab.label}
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
                  <Text style={styles.matrixHeaderCellText}>PARTICIPANTE / GRUPO</Text>
                </View>
                <View style={styles.tierCol}>
                  <Text style={styles.matrixHeaderCellText}>ESCALÃO / GRADE</Text>
                </View>
                <View style={styles.rotationCol}>
                  <Text style={styles.matrixHeaderCellText}>ROTAÇÃO</Text>
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
    padding: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 8,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
  },
  topActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  addUserInput: {
    minWidth: 180,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  searchInput: {
    width: 140,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#090D16',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  domainTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  domainTabText: {
    color: '#CBD5E1',
    fontSize: 11,
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
    width: 140,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
  },
  rotationCol: {
    width: 68,
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
  },
  capColHeader: {
    width: 78,
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
    width: 78,
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
