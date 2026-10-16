/**
 * Component: AddressEditModal
 *
 * Full manual editor for territory addresses.
 * Allows viewing and editing:
 * - Street line, Number, Neighborhood, City, State, Postal Code (CEP)
 * - Property Type (Residencial, Comercial, Prédio, etc.)
 * - Foreign language tagging (Estrangeiro & Idioma)
 * - Geolocation coordinates (Latitude & Longitude) with GPS device capture
 * - Field work status (Pendente / Trabalhado)
 * - Field notes and observation annotations
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
  Platform,
  ActivityIndicator,
} from 'react-native';
import type { FlatSkeletonEntry } from '@sekundo/core';

interface AddressEditModalProps {
  visible: boolean;
  item: FlatSkeletonEntry | null;
  onClose: () => void;
  onSave: (
    key: string,
    updates: {
      label: string;
      value?: string;
      meta: Record<string, any>;
    }
  ) => Promise<void>;
}

export function AddressEditModal({ visible, item, onClose, onSave }: AddressEditModalProps) {
  if (!item) return null;

  const rawMeta = (item.meta || {}) as Record<string, any>;

  // Form states
  const [label, setLabel] = useState('');
  const [territoryNumber, setTerritoryNumber] = useState('');
  const [locality, setLocality] = useState('');
  const [line, setLine] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('SP');
  const [postalcode, setPostalcode] = useState('');
  const [propertyType, setPropertyType] = useState<'residencial' | 'comercial' | 'predio' | 'outro'>('residencial');
  const [isForeign, setIsForeign] = useState(false);
  const [language, setLanguage] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [assignedAt, setAssignedAt] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [worked, setWorked] = useState(0);
  const [workerName, setWorkerName] = useState('');
  const [notes, setNotes] = useState('');
  const [capturingGPS, setCapturingGPS] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync state whenever active item changes
  useEffect(() => {
    if (item) {
      const meta = (item.meta || {}) as Record<string, any>;
      setLabel(item.label || '');
      setTerritoryNumber(meta.territory_number || meta.territory || '');
      setLocality(meta.locality || '');
      setLine(meta.line || '');
      setLine2(meta.line2 || meta.neighborhood || meta.bairro || '');
      setCity(meta.city || meta.cidade || '');
      setState(meta.state || meta.uf || 'SP');
      setPostalcode(meta.postalcode || meta.cep || '');
      
      const propType = meta.property_type || meta.tipo_imovel || 'residencial';
      setPropertyType(propType);

      setIsForeign(Boolean(meta.is_foreign || meta.foreign || meta.estrangeiro || meta.language));
      setLanguage(meta.language || meta.idioma || '');

      setLat(meta.lat != null ? String(meta.lat) : (meta.latitude != null ? String(meta.latitude) : ''));
      setLng(meta.lng != null ? String(meta.lng) : (meta.longitude != null ? String(meta.longitude) : ''));

      setAssignedAt(meta.assignedAt || meta.assigned_date || meta.data_designacao || '');
      setCompletedAt(meta.completedAt || meta.completed_date || meta.data_conclusao || '');

      setWorked(Number(meta.worked) === 1 ? 1 : 0);
      setWorkerName(item.value || meta.workerName || '');
      setNotes(meta.notes || meta.observacoes || '');
    }
  }, [item]);

  // GPS Device Capture
  const handleCaptureCurrentGPS = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setCapturingGPS(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toFixed(6));
          setLng(position.coords.longitude.toFixed(6));
          setCapturingGPS(false);
        },
        (error) => {
          console.warn('[GPS] Error getting location:', error);
          alert('Não foi possível capturar o GPS: ' + error.message);
          setCapturingGPS(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert('Geolocalização não suportada neste dispositivo.');
    }
  };

  const handleSave = async () => {
    if (!item) return;
    try {
      setSaving(true);

      const parsedLat = lat.trim() ? parseFloat(lat.trim()) : undefined;
      const parsedLng = lng.trim() ? parseFloat(lng.trim()) : undefined;

      const updatedMeta: Record<string, any> = {
        ...rawMeta,
        territory_number: territoryNumber.trim(),
        locality: locality.trim(),
        line: line.trim(),
        line2: line2.trim(),
        neighborhood: line2.trim(),
        city: city.trim(),
        state: state.trim(),
        postalcode: postalcode.trim(),
        property_type: propertyType,
        is_foreign: isForeign,
        language: isForeign ? language.trim() : undefined,
        lat: isNaN(parsedLat as number) ? undefined : parsedLat,
        lng: isNaN(parsedLng as number) ? undefined : parsedLng,
        assignedAt: assignedAt.trim() || undefined,
        completedAt: completedAt.trim() || undefined,
        worked,
        workerName: workerName.trim(),
        notes: notes.trim(),
        lastWorkedAt: worked === 1 ? (completedAt.trim() || rawMeta.lastWorkedAt || new Date().toISOString()) : undefined,
      };

      // Construct a clean descriptive label if not customized
      const finalLabel = label.trim() || `${line.trim()}${line2.trim() ? ` (${line2.trim()})` : ''}`;

      await onSave(item.key, {
        label: finalLabel,
        value: worked === 1 ? (workerName.trim() || 'Trabalhado') : '',
        meta: updatedMeta,
      });

      onClose();
    } catch (err: any) {
      console.error('[AddressEditModal] Save error:', err);
      alert('Erro ao salvar endereço: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>✏️ Editar Informações do Endereço</Text>
              <Text style={styles.modalSubtitle}>Código: {item.key} • Território: {territoryNumber || 'Geral'}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollForm} contentContainerStyle={styles.formContent}>
            {/* 1. Endereço Completo */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>📍 LOCALIZAÇÃO & ENDEREÇO</Text>

              <Text style={styles.inputLabel}>Rótulo / Título de Exibição</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="Ex: Av. Central, 100 (Setor Norte)"
                placeholderTextColor="#6F7E94"
              />

              <View style={styles.row}>
                <View style={[styles.col, { flex: 2, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Logradouro e Número</Text>
                  <TextInput
                    style={styles.input}
                    value={line}
                    onChangeText={setLine}
                    placeholder="Ex: Av. Central, 100"
                    placeholderTextColor="#6F7E94"
                  />
                </View>
                <View style={[styles.col, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Bairro / Complemento</Text>
                  <TextInput
                    style={styles.input}
                    value={line2}
                    onChangeText={setLine2}
                    placeholder="Ex: Setor Norte"
                    placeholderTextColor="#6F7E94"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.col, { flex: 2, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Cidade</Text>
                  <TextInput
                    style={styles.input}
                    value={city}
                    onChangeText={setCity}
                    placeholder="Ex: Cidade Metropolitana"
                    placeholderTextColor="#6F7E94"
                  />
                </View>
                <View style={[styles.col, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>UF</Text>
                  <TextInput
                    style={styles.input}
                    value={state}
                    onChangeText={setState}
                    placeholder="SP"
                    placeholderTextColor="#6F7E94"
                    maxLength={2}
                  />
                </View>
                <View style={[styles.col, { flex: 1.5 }]}>
                  <Text style={styles.inputLabel}>CEP</Text>
                  <TextInput
                    style={styles.input}
                    value={postalcode}
                    onChangeText={setPostalcode}
                    placeholder="01000-000"
                    placeholderTextColor="#6F7E94"
                  />
                </View>
              </View>
            </View>

            {/* 2. Tipo de Imóvel e Estrangeiro */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>🏠 CARACTERÍSTICAS DO IMÓVEL</Text>

              <Text style={styles.inputLabel}>Tipo de Estabelecimento</Text>
              <View style={styles.chipRow}>
                {(['residencial', 'comercial', 'predio', 'outro'] as const).map((type) => {
                  const active = propertyType === type;
                  const icons: Record<string, string> = {
                    residencial: '🏠 Residência',
                    comercial: '🏢 Comércio',
                    predio: '🏙️ Prédio / Condomínio',
                    outro: '📦 Outro',
                  };
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setPropertyType(type)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {icons[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.foreignSection}>
                <View style={styles.foreignToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Atendimento em Outro Idioma / Requisito Especial?</Text>
                    <Text style={styles.helperText}>Destaque unidades que requerem atendimento técnico ou comunicação em outro idioma.</Text>
                  </View>
                  <Pressable
                    onPress={() => setIsForeign(!isForeign)}
                    style={[styles.toggleBtn, isForeign && styles.toggleBtnActive]}
                  >
                    <Text style={[styles.toggleBtnText, isForeign && styles.toggleBtnTextActive]}>
                      {isForeign ? '🌐 SIM' : 'NÃO'}
                    </Text>
                  </Pressable>
                </View>

                {isForeign ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.inputLabel}>Idioma / Especificação de Atendimento</Text>
                    <TextInput
                      style={styles.input}
                      value={language}
                      onChangeText={setLanguage}
                      placeholder="Ex: Espanhol, Inglês, Francês, Libras..."
                      placeholderTextColor="#6F7E94"
                    />
                  </View>
                ) : null}
              </View>
            </View>

            {/* 3. Coordenadas GPS */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionHeader}>🧭 GEOLOCALIZAÇÃO (MAPA)</Text>
                <Pressable
                  onPress={handleCaptureCurrentGPS}
                  disabled={capturingGPS}
                  style={styles.gpsCaptureBtn}
                >
                  {capturingGPS ? (
                    <ActivityIndicator size="small" color="#FFB800" />
                  ) : (
                    <Text style={styles.gpsCaptureBtnText}>📍 Capturar GPS Atual</Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.row}>
                <View style={[styles.col, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Latitude</Text>
                  <TextInput
                    style={styles.input}
                    value={lat}
                    onChangeText={setLat}
                    placeholder="Ex: -23.548843"
                    placeholderTextColor="#6F7E94"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.col, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Longitude</Text>
                  <TextInput
                    style={styles.input}
                    value={lng}
                    onChangeText={setLng}
                    placeholder="Ex: -46.389824"
                    placeholderTextColor="#6F7E94"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* 4. Cronograma & Datas de Cobertura */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>📅 CRONOGRAMA & DATAS DE COBERTURA</Text>
              <View style={[styles.row, { gap: 12, alignItems: 'flex-start' }]}>
                <View style={[styles.col, { flex: 1 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.inputLabel}>Data da Designação</Text>
                    <Pressable
                      onPress={() => setAssignedAt(new Date().toISOString().slice(0, 10))}
                      style={styles.quickDateBtn}
                    >
                      <Text style={styles.quickDateBtnText}>Hoje</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={assignedAt}
                    onChangeText={setAssignedAt}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor="#6F7E94"
                  />
                </View>

                <View style={[styles.col, { flex: 1 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.inputLabel}>Data da Conclusão</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable
                        onPress={() => {
                          setCompletedAt(new Date().toISOString().slice(0, 10));
                          setWorked(1);
                        }}
                        style={styles.quickDateBtn}
                      >
                        <Text style={styles.quickDateBtnText}>Hoje</Text>
                      </Pressable>
                      {completedAt ? (
                        <Pressable onPress={() => setCompletedAt('')} style={styles.quickDateBtn}>
                          <Text style={styles.quickDateBtnText}>Limpar</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={completedAt}
                    onChangeText={setCompletedAt}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor="#6F7E94"
                  />
                </View>
              </View>

              {completedAt.trim() ? (
                <View style={styles.recencyBadgeBox}>
                  {(() => {
                    const clean = completedAt.trim();
                    const d = new Date(clean.includes('T') ? clean : `${clean}T00:00:00`);
                    if (isNaN(d.getTime())) return null;
                    const today = new Date();
                    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const ref = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    const diff = Math.floor((t0.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <Text style={styles.recencyBadgeText}>
                        {diff === 0
                          ? '✨ Concluído hoje'
                          : diff === 1
                          ? '✓ Concluído ontem (1 dia atrás)'
                          : `✓ Concluído há ${diff} dias`}
                      </Text>
                    );
                  })()}
                </View>
              ) : null}
            </View>

            {/* 5. Status de Campo & Notas */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>📋 COBERTURA & OBSERVAÇÕES DE CAMPO</Text>

              <Text style={styles.inputLabel}>Status de Visita</Text>
              <View style={styles.chipRow}>
                <Pressable
                  onPress={() => {
                    setWorked(0);
                  }}
                  style={[styles.statusChip, worked === 0 && styles.statusPendingActive]}
                >
                  <Text style={[styles.statusChipText, worked === 0 && styles.statusPendingTextActive]}>
                    ⬜ Pendente
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setWorked(1);
                    if (!completedAt) {
                      setCompletedAt(new Date().toISOString().slice(0, 10));
                    }
                  }}
                  style={[styles.statusChip, worked === 1 && styles.statusWorkedActive]}
                >
                  <Text style={[styles.statusChipText, worked === 1 && styles.statusWorkedTextActive]}>
                    ✓ Trabalhado / Concluído
                  </Text>
                </Pressable>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Operador Responsável</Text>
              <TextInput
                style={styles.input}
                value={workerName}
                onChangeText={setWorkerName}
                placeholder="Ex: Participante 01"
                placeholderTextColor="#6F7E94"
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Notas de Campo / Instruções Específicas</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Ex: Não bater campainha, chamar no portão. Local possui cão de guarda. Solicitou retorno após às 18h..."
                placeholderTextColor="#6F7E94"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <Pressable onPress={onClose} style={styles.cancelBtn} disabled={saving}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={styles.saveBtn} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#12151C" />
              ) : (
                <Text style={styles.saveBtnText}>✓ Salvar Alterações</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#161922',
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnText: {
    color: '#A9B4C5',
    fontSize: 18,
  },
  scrollForm: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    gap: 20,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionHeader: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  inputLabel: {
    color: '#C3D0E5',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  helperText: {
    color: '#6F7E94',
    fontSize: 11,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    color: '#FFFFFF',
    padding: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  col: {
    display: 'flex',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#8B5CF6',
  },
  chipText: {
    color: '#8A94A6',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#A78BFA',
  },
  foreignSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  foreignToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  toggleBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#60A5FA',
  },
  toggleBtnText: {
    color: '#8A94A6',
    fontWeight: '700',
    fontSize: 11,
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
  gpsCaptureBtn: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFB800',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  gpsCaptureBtnText: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '700',
  },
  statusChip: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statusPendingActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  statusPendingTextActive: {
    color: '#F87171',
    fontWeight: '700',
  },
  statusWorkedActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  statusWorkedTextActive: {
    color: '#34D399',
    fontWeight: '700',
  },
  statusChipText: {
    color: '#8A94A6',
    fontSize: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cancelBtnText: {
    color: '#A9B4C5',
    fontWeight: '600',
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: '#FFB800',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#12151C',
    fontWeight: '700',
    fontSize: 13,
  },
  quickDateBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 4,
  },
  quickDateBtnText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '600',
  },
  recencyBadgeBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    alignItems: 'center',
  },
  recencyBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
});
