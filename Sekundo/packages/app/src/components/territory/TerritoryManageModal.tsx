/**
 * Component: TerritoryManageModal
 *
 * Unified In-App Territory CRUD, Zero-Bureaucracy Location Sharing & CSV Model Export Modal.
 * Solves:
 * 1. Renaming and renumbering territories and quadras directly in the app (`✏️ Editar`).
 * 2. Adding brand-new territories and quadras without importing spreadsheets (`➕ Novo Território`).
 * 3. Adding new addresses/houses to any territory (`🏠 Novo Endereço`).
 * 4. Zero-bureaucracy sharing of territory/quadra locations via WhatsApp / Copy / Maps (`📲 Compartilhar`).
 * 5. 1-click export of the updated territory CSV model from local memory (`📤 Exportar Modelo CSV`).
 */

import React, { useState, useEffect, useMemo } from 'react';
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
import {
  extractTerritorySummaries,
  resolveTerritoryNameFromNodes,
  renameOrRenumberTerritory,
  createTerritoryOrQuadra,
  createAddressInTerritory,
  deleteTerritoryOrQuadra,
  formatShareTerritoryOrQuadraLocationsText,
  resolveTerritoryNumber,
  type FlatSkeletonEntry,
} from '@sekundo/core';
import {
  exportUpdatedTerritoryModelCsvFromStorage,
  triggerCsvFileDownloadOrCopy,
  shareLocationPayload,
} from '../../storage/omniStorageBridge';
import { openExternalGoogleMaps } from '../../hooks/useLiveGpsLocation';

export type TerritoryManageTab = 'edit' | 'new_territory' | 'new_address' | 'share_export';

export interface TerritoryManageModalProps {
  visible: boolean;
  initialTab?: TerritoryManageTab;
  targetTerritoryNumber?: string;
  targetGroupKey?: string;
  targetGroupLabel?: string;
  cleanNodes: FlatSkeletonEntry[];
  onClose: () => void;
  onCommitNodes: (
    nextCleanNodes: FlatSkeletonEntry[],
    metaInfo?: { activeTerritoryNumber?: string; message?: string }
  ) => Promise<void>;
}

export function TerritoryManageModal({
  visible,
  initialTab = 'edit',
  targetTerritoryNumber,
  targetGroupKey,
  targetGroupLabel,
  cleanNodes,
  onClose,
  onCommitNodes,
}: TerritoryManageModalProps) {
  const summaries = useMemo(() => extractTerritorySummaries(cleanNodes), [cleanNodes]);

  const effectiveTargetTerritory = useMemo(() => {
    if (targetTerritoryNumber && targetTerritoryNumber !== 'all') {
      return targetTerritoryNumber;
    }
    return summaries[0]?.territoryNumber || '01';
  }, [targetTerritoryNumber, summaries]);

  const [activeTab, setActiveTab] = useState<TerritoryManageTab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // --- Tab 1: Edit Territory / Quadra State ---
  const [selectedEditTerritory, setSelectedEditTerritory] = useState(effectiveTargetTerritory);
  const [editTerritoryNumber, setEditTerritoryNumber] = useState('');
  const [editTerritoryName, setEditTerritoryName] = useState('');
  const [editGroupLabel, setEditGroupLabel] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editScope, setEditScope] = useState<'territory' | 'quadra'>('territory');

  // --- Tab 2: New Territory State ---
  const [newTerrNumber, setNewTerrNumber] = useState('');
  const [newTerrName, setNewTerrName] = useState('');
  const [newTerrQuadraLabel, setNewTerrQuadraLabel] = useState('');
  const [newTerrCity, setNewTerrCity] = useState('');
  const [newTerrStreet, setNewTerrStreet] = useState('');
  const [newTerrHouseNum, setNewTerrHouseNum] = useState('');
  const [newTerrLat, setNewTerrLat] = useState('');
  const [newTerrLng, setNewTerrLng] = useState('');
  const [newTerrNotes, setNewTerrNotes] = useState('');

  // --- Tab 3: New Address State ---
  const [addrTerritoryNumber, setAddrTerritoryNumber] = useState(effectiveTargetTerritory);
  const [addrGroupKey, setAddrGroupKey] = useState(targetGroupKey || '');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrNumber, setAddrNumber] = useState('');
  const [addrNeighborhood, setAddrNeighborhood] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrPostalCode, setAddrPostalCode] = useState('');
  const [addrLat, setAddrLat] = useState('');
  const [addrLng, setAddrLng] = useState('');
  const [addrNotes, setAddrNotes] = useState('');
  const [capturingGps, setCapturingGps] = useState(false);

  // --- Tab 4: Share & Export State ---
  const [shareOnlyPending, setShareOnlyPending] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Sync fields when modal opens or target changes
  useEffect(() => {
    if (!visible) return;
    setActiveTab(initialTab);
    setFeedback(null);
    setConfirmDelete(false);

    const tNum = effectiveTargetTerritory;
    setSelectedEditTerritory(tNum);
    const summary = summaries.find((s) => s.territoryNumber === tNum);
    const resolvedName = summary?.territoryName || resolveTerritoryNameFromNodes(cleanNodes, tNum);
    const defaultCity = summary?.city || summaries[0]?.city || 'São Paulo';

    setEditTerritoryNumber(tNum);
    setEditTerritoryName(resolvedName);
    setEditGroupLabel(targetGroupLabel || '');
    setEditCity(defaultCity);
    setEditScope('territory');

    // Suggest next available territory number for "Novo Território"
    const maxNum = summaries.reduce((max, s) => {
      const n = parseInt(s.territoryNumber.replace(/\D/g, ''), 10);
      return !isNaN(n) && n > max ? n : max;
    }, 0);
    setNewTerrNumber(String(maxNum + 1).padStart(2, '0'));
    setNewTerrName('');
    setNewTerrQuadraLabel('');
    setNewTerrCity(defaultCity);
    setNewTerrStreet('');
    setNewTerrHouseNum('');
    setNewTerrLat('');
    setNewTerrLng('');
    setNewTerrNotes('');

    setAddrTerritoryNumber(tNum);
    setAddrGroupKey(targetGroupKey || summary?.quadraKeys[0] || '');
    setAddrStreet('');
    setAddrNumber('');
    setAddrNeighborhood(resolvedName);
    setAddrCity(defaultCity);
    setAddrPostalCode('');
    setAddrLat('');
    setAddrLng('');
    setAddrNotes('');
  }, [visible, initialTab, effectiveTargetTerritory, targetGroupKey, targetGroupLabel, summaries, cleanNodes]);

  // Update edit fields if user picks another territory chip inside Tab 1
  const handleSelectTerritoryToEdit = (tNum: string) => {
    setSelectedEditTerritory(tNum);
    const summary = summaries.find((s) => s.territoryNumber === tNum);
    const resolvedName = summary?.territoryName || resolveTerritoryNameFromNodes(cleanNodes, tNum);
    setEditTerritoryNumber(tNum);
    setEditTerritoryName(resolvedName);
    setEditCity(summary?.city || editCity || 'São Paulo');
    setConfirmDelete(false);
  };

  const captureDeviceGps = (target: 'new_territory' | 'new_address') => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setFeedback('⚠️ Geolocalização não suportada neste navegador/dispositivo.');
      return;
    }
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latStr = pos.coords.latitude.toFixed(6);
        const lngStr = pos.coords.longitude.toFixed(6);
        if (target === 'new_territory') {
          setNewTerrLat(latStr);
          setNewTerrLng(lngStr);
        } else {
          setAddrLat(latStr);
          setAddrLng(lngStr);
        }
        setCapturingGps(false);
        setFeedback('🛰️ Coordenadas GPS capturadas com sucesso!');
      },
      (err) => {
        setCapturingGps(false);
        setFeedback(`⚠️ Não foi possível capturar GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveEditTerritory = async () => {
    if (!editTerritoryNumber.trim()) {
      setFeedback('⚠️ Informe o número do território.');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const nextNodes = renameOrRenumberTerritory(cleanNodes, selectedEditTerritory, {
        newTerritoryNumber: editTerritoryNumber.trim(),
        newTerritoryName: editTerritoryName.trim(),
        newCity: editCity.trim(),
        targetGroupKey: targetGroupKey || undefined,
        newGroupLabel: editGroupLabel.trim() || undefined,
        scope: targetGroupKey ? editScope : 'territory',
      });

      const finalNum = editTerritoryNumber.trim().padStart(
        /^\d+$/.test(editTerritoryNumber.trim()) && editTerritoryNumber.trim().length === 1 ? 2 : 0,
        '0'
      );

      await onCommitNodes(nextNodes, {
        activeTerritoryNumber: finalNum,
        message: `✓ Território ${finalNum}${editTerritoryName.trim() ? ` (${editTerritoryName.trim()})` : ''} salvo na memória!`,
      });
      setSelectedEditTerritory(finalNum);
      setFeedback(
        `✓ Alterações salvas na memória! O Território agora é "${finalNum}${
          editTerritoryName.trim() ? ` — ${editTerritoryName.trim()}` : ''
        }".`
      );
    } catch (err: any) {
      setFeedback(`⚠️ Erro ao salvar: ${err?.message || 'Falha desconhecida'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTerritoryOrQuadra = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const nextNodes = deleteTerritoryOrQuadra(
        cleanNodes,
        editScope === 'quadra' && targetGroupKey
          ? { groupKey: targetGroupKey }
          : { territoryNumber: selectedEditTerritory }
      );
      if (nextNodes.length === 0) {
        setFeedback('⚠️ Não é possível excluir o único território restante.');
        setBusy(false);
        return;
      }
      await onCommitNodes(nextNodes, {
        message: '🗑️ Registro removido da memória.',
      });
      setConfirmDelete(false);
      onClose();
    } catch (err: any) {
      setFeedback(`⚠️ Erro ao excluir: ${err?.message || 'Falha desconhecida'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateNewTerritory = async () => {
    if (!newTerrNumber.trim()) {
      setFeedback('⚠️ Digite o número do novo território.');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = createTerritoryOrQuadra(cleanNodes, {
        territoryNumber: newTerrNumber.trim(),
        territoryName: newTerrName.trim() || `Setor ${newTerrNumber.trim()}`,
        quadraLabel: newTerrQuadraLabel.trim() || undefined,
        city: newTerrCity.trim() || 'São Paulo',
        initialAddress: {
          street: newTerrStreet.trim() || `Rua Principal (${newTerrName.trim() || `Território ${newTerrNumber.trim()}`})`,
          number: newTerrHouseNum.trim() || '100',
          neighborhood: newTerrName.trim(),
          lat: newTerrLat.trim() || undefined,
          lng: newTerrLng.trim() || undefined,
          notes: newTerrNotes.trim() || undefined,
        },
      });

      const createdNum = resolveTerritoryNumber(result.nodes[result.nodes.length - 1]);
      await onCommitNodes(result.nodes, {
        activeTerritoryNumber: createdNum,
        message: `✓ Novo Território ${createdNum} criado e salvo na memória!`,
      });
      setFeedback(
        `✓ Novo Território ${createdNum} (${
          newTerrName.trim() || 'Novo Setor'
        }) criado e salvo na memória!`
      );
      setSelectedEditTerritory(createdNum);
      setAddrTerritoryNumber(createdNum);
    } catch (err: any) {
      setFeedback(`⚠️ Erro ao criar território: ${err?.message || 'Falha desconhecida'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateNewAddress = async () => {
    if (!addrStreet.trim()) {
      setFeedback('⚠️ Digite o nome da rua / logradouro.');
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const result = createAddressInTerritory(cleanNodes, {
        territoryNumber: addrTerritoryNumber.trim() || effectiveTargetTerritory,
        groupKey: addrGroupKey.trim() || undefined,
        street: addrStreet.trim(),
        number: addrNumber.trim() || 'S/N',
        neighborhood: addrNeighborhood.trim() || undefined,
        city: addrCity.trim() || undefined,
        postalcode: addrPostalCode.trim() || undefined,
        lat: addrLat.trim() || undefined,
        lng: addrLng.trim() || undefined,
        notes: addrNotes.trim() || undefined,
      });

      await onCommitNodes(result.nodes, {
        activeTerritoryNumber: addrTerritoryNumber.trim() || effectiveTargetTerritory,
        message: `✓ Endereço "${addrStreet.trim()}, ${addrNumber.trim() || 'S/N'}" adicionado na memória!`,
      });
      setFeedback(
        `✓ Endereço "${addrStreet.trim()}, ${addrNumber.trim() || 'S/N'}" adicionado ao Território ${addrTerritoryNumber}!`
      );
      setAddrStreet('');
      setAddrNumber('');
      setAddrNotes('');
    } catch (err: any) {
      setFeedback(`⚠️ Erro ao adicionar endereço: ${err?.message || 'Falha desconhecida'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = async (mode: 'flat_s13' | 'omni_single' | 'omni_full') => {
    setBusy(true);
    setFeedback(null);
    try {
      const { csvText, filename } = await exportUpdatedTerritoryModelCsvFromStorage(
        cleanNodes,
        mode
      );
      const outcome = await triggerCsvFileDownloadOrCopy(csvText, filename);
      setFeedback(
        outcome === 'downloaded'
          ? `📥 Arquivo "${filename}" baixado com todas as alterações feitas no aplicativo!`
          : `📋 Modelo CSV "${filename}" copiado para a área de transferência!`
      );
    } catch (err: any) {
      setFeedback(`⚠️ Erro ao exportar CSV: ${err?.message || 'Falha desconhecida'}`);
    } finally {
      setBusy(false);
    }
  };

  // Share preview for the selected territory
  const sharePayload = useMemo(() => {
    const tNum = selectedEditTerritory || effectiveTargetTerritory;
    const tNodes = cleanNodes.filter((n) => resolveTerritoryNumber(n) === tNum);
    return formatShareTerritoryOrQuadraLocationsText({
      territoryNumber: tNum,
      territoryName: editTerritoryName || resolveTerritoryNameFromNodes(cleanNodes, tNum),
      quadraKey: editScope === 'quadra' && targetGroupKey ? targetGroupKey : undefined,
      quadraLabel: editScope === 'quadra' && targetGroupLabel ? targetGroupLabel : undefined,
      items: tNodes.length > 0 ? tNodes : cleanNodes,
      city: editCity,
      onlyPending: shareOnlyPending,
    });
  }, [
    cleanNodes,
    selectedEditTerritory,
    effectiveTargetTerritory,
    editTerritoryName,
    editScope,
    targetGroupKey,
    targetGroupLabel,
    editCity,
    shareOnlyPending,
  ]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                🗂️ Gerenciar Territórios, Localizações e Modelo CSV
              </Text>
              <Text style={styles.subtitle}>
                Edite nomes e números direto no app • Salva automaticamente na memória • Exportação e compartilhamento sem burocracia
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} testID="territory-manage-close-btn">
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsRow}>
            <Pressable
              testID="territory-manage-tab-edit"
              onPress={() => {
                setActiveTab('edit');
                setFeedback(null);
              }}
              style={[styles.tabBtn, activeTab === 'edit' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, activeTab === 'edit' && styles.tabBtnTextActive]}>
                ✏️ Editar Nome / Nº
              </Text>
            </Pressable>

            <Pressable
              testID="territory-manage-tab-new-territory"
              onPress={() => {
                setActiveTab('new_territory');
                setFeedback(null);
              }}
              style={[styles.tabBtn, activeTab === 'new_territory' && styles.tabBtnActive]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'new_territory' && styles.tabBtnTextActive,
                ]}
              >
                ➕ Novo Território
              </Text>
            </Pressable>

            <Pressable
              testID="territory-manage-tab-new-address"
              onPress={() => {
                setActiveTab('new_address');
                setFeedback(null);
              }}
              style={[styles.tabBtn, activeTab === 'new_address' && styles.tabBtnActive]}
            >
              <Text
                style={[styles.tabBtnText, activeTab === 'new_address' && styles.tabBtnTextActive]}
              >
                🏠 + Endereço
              </Text>
            </Pressable>

            <Pressable
              testID="territory-manage-tab-share-export"
              onPress={() => {
                setActiveTab('share_export');
                setFeedback(null);
              }}
              style={[styles.tabBtn, activeTab === 'share_export' && styles.tabBtnActive]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'share_export' && styles.tabBtnTextActive,
                ]}
              >
                📲 Compartilhar & CSV
              </Text>
            </Pressable>
          </View>

          {feedback ? (
            <View style={styles.feedbackBanner} testID="territory-manage-feedback">
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 14 }}>
            {/* ==================== TAB 1: EDIT TERRITORY / QUADRA ==================== */}
            {activeTab === 'edit' ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  ✏️ ALTERAR NÚMERO E NOME DO TERRITÓRIO NA MEMÓRIA
                </Text>
                <Text style={styles.helperText}>
                  Escolha o território abaixo e altere seu número, nome/bairro ou cidade. Todos os endereços e quadras vinculados serão atualizados automaticamente na memória.
                </Text>

                {/* Quick Territory Selector Chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
                >
                  {summaries.map((s) => {
                    const isSelected = s.territoryNumber === selectedEditTerritory;
                    return (
                      <Pressable
                        key={s.territoryNumber}
                        testID={`manage-select-territory-${s.territoryNumber}`}
                        onPress={() => handleSelectTerritoryToEdit(s.territoryNumber)}
                        style={[styles.terrChip, isSelected && styles.terrChipActive]}
                      >
                        <Text
                          style={[styles.terrChipText, isSelected && styles.terrChipTextActive]}
                        >
                          Nº {s.territoryNumber}
                          {s.territoryName ? ` • ${s.territoryName}` : ''} ({s.totalAddresses})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {targetGroupKey ? (
                  <View style={styles.scopeRow}>
                    <Pressable
                      onPress={() => setEditScope('territory')}
                      style={[
                        styles.scopeBtn,
                        editScope === 'territory' && styles.scopeBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.scopeBtnText,
                          editScope === 'territory' && styles.scopeBtnTextActive,
                        ]}
                      >
                        🌐 Todo o Território {selectedEditTerritory}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditScope('quadra')}
                      style={[styles.scopeBtn, editScope === 'quadra' && styles.scopeBtnActive]}
                    >
                      <Text
                        style={[
                          styles.scopeBtnText,
                          editScope === 'quadra' && styles.scopeBtnTextActive,
                        ]}
                      >
                        🔷 Apenas Quadra {targetGroupKey}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Número do Território *</Text>
                    <TextInput
                      testID="edit-territory-number-input"
                      style={styles.input}
                      value={editTerritoryNumber}
                      onChangeText={setEditTerritoryNumber}
                      placeholder="Ex: 01, 02, 15..."
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.label}>Nome do Território / Bairro / Setor *</Text>
                    <TextInput
                      testID="edit-territory-name-input"
                      style={styles.input}
                      value={editTerritoryName}
                      onChangeText={setEditTerritoryName}
                      placeholder="Ex: Centro Norte, Jardim América..."
                      placeholderTextColor="#64748B"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  {targetGroupKey ? (
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.label}>Título da Quadra ({targetGroupKey})</Text>
                      <TextInput
                        testID="edit-quadra-label-input"
                        style={styles.input}
                        value={editGroupLabel}
                        onChangeText={setEditGroupLabel}
                        placeholder="Ex: Quadra 01 — Praça Central"
                        placeholderTextColor="#64748B"
                      />
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Cidade</Text>
                    <TextInput
                      testID="edit-territory-city-input"
                      style={styles.input}
                      value={editCity}
                      onChangeText={setEditCity}
                      placeholder="Ex: São Paulo"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    testID="save-edit-territory-btn"
                    disabled={busy}
                    onPress={handleSaveEditTerritory}
                    style={[styles.primaryBtn, { flex: 1 }]}
                  >
                    {busy ? (
                      <ActivityIndicator color="#062016" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        💾 Salvar Nome e Número na Memória
                      </Text>
                    )}
                  </Pressable>

                  {!confirmDelete ? (
                    <Pressable
                      testID="request-delete-territory-btn"
                      onPress={() => setConfirmDelete(true)}
                      style={styles.dangerOutlineBtn}
                    >
                      <Text style={styles.dangerOutlineBtnText}>🗑️ Excluir</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      testID="confirm-delete-territory-btn"
                      onPress={handleDeleteTerritoryOrQuadra}
                      style={styles.dangerSolidBtn}
                    >
                      <Text style={styles.dangerSolidBtnText}>⚠️ Confirmar Exclusão</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : null}

            {/* ==================== TAB 2: CREATE NEW TERRITORY ==================== */}
            {activeTab === 'new_territory' ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  ➕ ADICIONAR NOVO TERRITÓRIO DIRETO NO APLICATIVO
                </Text>
                <Text style={styles.helperText}>
                  Crie um território novo sem precisar importar planilha. Ele será salvo imediatamente na memória e incluído quando você exportar o modelo CSV.
                </Text>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Nº do Novo Território *</Text>
                    <TextInput
                      testID="new-territory-number-input"
                      style={styles.input}
                      value={newTerrNumber}
                      onChangeText={setNewTerrNumber}
                      placeholder="Ex: 17"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.label}>Nome do Território / Bairro *</Text>
                    <TextInput
                      testID="new-territory-name-input"
                      style={styles.input}
                      value={newTerrName}
                      onChangeText={setNewTerrName}
                      placeholder="Ex: Vila Mariana, Setor Sul..."
                      placeholderTextColor="#64748B"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.label}>Nome da 1ª Quadra (Opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={newTerrQuadraLabel}
                      onChangeText={setNewTerrQuadraLabel}
                      placeholder="Ex: Quadra 01 — Comercial"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Cidade</Text>
                    <TextInput
                      style={styles.input}
                      value={newTerrCity}
                      onChangeText={setNewTerrCity}
                      placeholder="Ex: São Paulo"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 6 }]}>
                  🏠 1º ENDEREÇO / RUA DO NOVO TERRITÓRIO (OPCIONAL)
                </Text>

                <View style={styles.row}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.label}>Logradouro / Rua</Text>
                    <TextInput
                      testID="new-territory-street-input"
                      style={styles.input}
                      value={newTerrStreet}
                      onChangeText={setNewTerrStreet}
                      placeholder="Ex: Av. Paulista"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Número / Compl.</Text>
                    <TextInput
                      testID="new-territory-housenum-input"
                      style={styles.input}
                      value={newTerrHouseNum}
                      onChangeText={setNewTerrHouseNum}
                      placeholder="Ex: 1000"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Latitude (Opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={newTerrLat}
                      onChangeText={setNewTerrLat}
                      placeholder="-23.550520"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Longitude (Opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={newTerrLng}
                      onChangeText={setNewTerrLng}
                      placeholder="-46.633308"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <Pressable
                    onPress={() => captureDeviceGps('new_territory')}
                    disabled={capturingGps}
                    style={[styles.secondaryBtn, { alignSelf: 'flex-end' }]}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {capturingGps ? '🛰️...' : '🛰️ Usar Meu GPS'}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>Observações Iniciais</Text>
                <TextInput
                  style={styles.input}
                  value={newTerrNotes}
                  onChangeText={setNewTerrNotes}
                  placeholder="Ex: Ponto de referência, horário..."
                  placeholderTextColor="#64748B"
                />

                <Pressable
                  testID="create-new-territory-submit-btn"
                  disabled={busy}
                  onPress={handleCreateNewTerritory}
                  style={styles.primaryBtn}
                >
                  {busy ? (
                    <ActivityIndicator color="#062016" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      ➕ Criar Novo Território e Salvar na Memória
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {/* ==================== TAB 3: ADD ADDRESS TO TERRITORY ==================== */}
            {activeTab === 'new_address' ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  🏠 ADICIONAR NOVO ENDEREÇO AO TERRITÓRIO
                </Text>

                {/* Quick Territory Selector */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
                >
                  {summaries.map((s) => {
                    const isSelected = s.territoryNumber === addrTerritoryNumber;
                    return (
                      <Pressable
                        key={s.territoryNumber}
                        onPress={() => {
                          setAddrTerritoryNumber(s.territoryNumber);
                          setAddrGroupKey(s.quadraKeys[0] || '');
                          setAddrNeighborhood(s.territoryName || '');
                          if (s.city) setAddrCity(s.city);
                        }}
                        style={[styles.terrChip, isSelected && styles.terrChipActive]}
                      >
                        <Text
                          style={[styles.terrChipText, isSelected && styles.terrChipTextActive]}
                        >
                          Território {s.territoryNumber}
                          {s.territoryName ? ` (${s.territoryName})` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.row}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.label}>Logradouro / Rua *</Text>
                    <TextInput
                      testID="new-address-street-input"
                      style={styles.input}
                      value={addrStreet}
                      onChangeText={setAddrStreet}
                      placeholder="Ex: Rua das Palmeiras"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Número / Compl. *</Text>
                    <TextInput
                      testID="new-address-number-input"
                      style={styles.input}
                      value={addrNumber}
                      onChangeText={setAddrNumber}
                      placeholder="Ex: 240 Apto 12"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Bairro / Localidade</Text>
                    <TextInput
                      style={styles.input}
                      value={addrNeighborhood}
                      onChangeText={setAddrNeighborhood}
                      placeholder="Ex: Centro"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Cidade</Text>
                    <TextInput
                      style={styles.input}
                      value={addrCity}
                      onChangeText={setAddrCity}
                      placeholder="Ex: São Paulo"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={{ flex: 0.8 }}>
                    <Text style={styles.label}>CEP</Text>
                    <TextInput
                      style={styles.input}
                      value={addrPostalCode}
                      onChangeText={setAddrPostalCode}
                      placeholder="01000-000"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Latitude</Text>
                    <TextInput
                      style={styles.input}
                      value={addrLat}
                      onChangeText={setAddrLat}
                      placeholder="-23.550520"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Longitude</Text>
                    <TextInput
                      style={styles.input}
                      value={addrLng}
                      onChangeText={setAddrLng}
                      placeholder="-46.633308"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <Pressable
                    onPress={() => captureDeviceGps('new_address')}
                    disabled={capturingGps}
                    style={[styles.secondaryBtn, { alignSelf: 'flex-end' }]}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {capturingGps ? '🛰️...' : '🛰️ Meu GPS'}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>Observações</Text>
                <TextInput
                  style={styles.input}
                  value={addrNotes}
                  onChangeText={setAddrNotes}
                  placeholder="Ex: Tocar campainha 2, comércio..."
                  placeholderTextColor="#64748B"
                />

                <Pressable
                  testID="create-new-address-submit-btn"
                  disabled={busy}
                  onPress={handleCreateNewAddress}
                  style={styles.primaryBtn}
                >
                  {busy ? (
                    <ActivityIndicator color="#062016" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      🏠 Salvar Novo Endereço no Território {addrTerritoryNumber}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {/* ==================== TAB 4: SHARE LOCATIONS & EXPORT CSV ==================== */}
            {activeTab === 'share_export' ? (
              <>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>
                    📲 COMPARTILHAR LOCALIZAÇÕES DIRETO (SEM BUROCRACIA / SEM PIN)
                  </Text>
                  <Text style={styles.helperText}>
                    Envie as localizações e links diretos do Google Maps deste território para qualquer pessoa no WhatsApp com 1 clique — sem precisar cadastrar privilégios, grupos ou senhas.
                  </Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
                  >
                    {summaries.map((s) => {
                      const isSelected = s.territoryNumber === selectedEditTerritory;
                      return (
                        <Pressable
                          key={s.territoryNumber}
                          onPress={() => handleSelectTerritoryToEdit(s.territoryNumber)}
                          style={[styles.terrChip, isSelected && styles.terrChipActive]}
                        >
                          <Text
                            style={[styles.terrChipText, isSelected && styles.terrChipTextActive]}
                          >
                            Território {s.territoryNumber}
                            {s.territoryName ? ` • ${s.territoryName}` : ''}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.scopeRow}>
                    <Pressable
                      onPress={() => setShareOnlyPending(false)}
                      style={[styles.scopeBtn, !shareOnlyPending && styles.scopeBtnActive]}
                    >
                      <Text
                        style={[
                          styles.scopeBtnText,
                          !shareOnlyPending && styles.scopeBtnTextActive,
                        ]}
                      >
                        📋 Todos os Endereços
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShareOnlyPending(true)}
                      style={[styles.scopeBtn, shareOnlyPending && styles.scopeBtnActive]}
                    >
                      <Text
                        style={[
                          styles.scopeBtnText,
                          shareOnlyPending && styles.scopeBtnTextActive,
                        ]}
                      >
                        ⬜ Apenas Pendentes
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    style={styles.sharePreviewBox}
                    multiline
                    editable={false}
                    value={sharePayload.text}
                  />

                  <View style={styles.actionRow}>
                    <Pressable
                      testID="share-territory-whatsapp-btn"
                      onPress={() => shareLocationPayload(sharePayload, 'whatsapp')}
                      style={[styles.whatsappBtn, { flex: 1 }]}
                    >
                      <Text style={styles.whatsappBtnText}>📲 Enviar no WhatsApp</Text>
                    </Pressable>

                    <Pressable
                      testID="share-territory-copy-btn"
                      onPress={async () => {
                        await shareLocationPayload(sharePayload, 'copy');
                        setCopiedShare(true);
                        setFeedback('📋 Mensagem com links do Google Maps copiada!');
                        setTimeout(() => setCopiedShare(false), 2500);
                      }}
                      style={styles.secondaryBtn}
                    >
                      <Text style={styles.secondaryBtnText}>
                        {copiedShare ? '✓ Copiado!' : '📋 Copiar Links'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        openExternalGoogleMaps({
                          label: sharePayload.title,
                          city: editCity,
                          mode: 'directions',
                        })
                      }
                      style={styles.secondaryBtn}
                    >
                      <Text style={styles.secondaryBtnText}>🗺️ Abrir Maps</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>
                    📤 EXPORTAR NOVO MODELO CSV DE ACORDO COM AS ALTERAÇÕES
                  </Text>
                  <Text style={styles.helperText}>
                    Gera e baixa a planilha atualizada diretamente da memória do aplicativo com todos os novos nomes, números e territórios criados, sem precisar editar CSV manualmente.
                  </Text>

                  <View style={{ gap: 8 }}>
                    <Pressable
                      testID="export-territory-flat-csv-btn"
                      disabled={busy}
                      onPress={() => handleExportCsv('flat_s13')}
                      style={styles.primaryBtn}
                    >
                      <Text style={styles.primaryBtnText}>
                        📥 Baixar Novo Modelo CSV de Territórios (Excel / Planilha S-13)
                      </Text>
                    </Pressable>

                    <View style={styles.actionRow}>
                      <Pressable
                        testID="export-territory-omni-single-btn"
                        disabled={busy}
                        onPress={() => handleExportCsv('omni_single')}
                        style={[styles.secondaryBtn, { flex: 1 }]}
                      >
                        <Text style={styles.secondaryBtnText}>
                          📦 Exportar Partição Territory CSV
                        </Text>
                      </Pressable>

                      <Pressable
                        testID="export-territory-omni-full-btn"
                        disabled={busy}
                        onPress={() => handleExportCsv('omni_full')}
                        style={[styles.secondaryBtn, { flex: 1 }]}
                      >
                        <Text style={styles.secondaryBtnText}>
                          🌐 Exportar CSV Geral (Omni Completo)
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>

          {/* Footer Quick Bar */}
          <View style={styles.footer}>
            <Pressable
              onPress={() => handleExportCsv('flat_s13')}
              style={styles.footerExportChip}
            >
              <Text style={styles.footerExportChipText}>
                📤 Baixar CSV Atualizado
              </Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.footerCloseBtn}>
              <Text style={styles.footerCloseBtnText}>Fechar</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '94%',
    backgroundColor: '#131822',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.28)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#1A2130',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 3,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '800',
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  tabBtn: {
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.18)',
    borderColor: '#FFB800',
  },
  tabBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#FFB800',
    fontWeight: '800',
  },
  feedbackBanner: {
    marginHorizontal: 16,
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  feedbackText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    padding: 16,
  },
  sectionCard: {
    backgroundColor: '#1A202C',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: 10,
  },
  sectionTitle: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  helperText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  terrChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  terrChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  terrChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  terrChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  scopeBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  scopeBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  scopeBtnTextActive: {
    color: '#93C5FD',
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  label: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0F131C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    color: '#FFFFFF',
    fontSize: 13,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#052014',
    fontSize: 13,
    fontWeight: '800',
  },
  whatsappBtn: {
    backgroundColor: '#22C55E',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappBtnText: {
    color: '#052E16',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  dangerOutlineBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 8,
  },
  dangerOutlineBtnText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '700',
  },
  dangerSolidBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 8,
  },
  dangerSolidBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sharePreviewBox: {
    backgroundColor: '#0B0F17',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#E2E8F0',
    fontSize: 11,
    padding: 10,
    minHeight: 110,
    maxHeight: 160,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A2130',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerExportChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFB800',
  },
  footerExportChipText: {
    color: '#FFB800',
    fontSize: 12,
    fontWeight: '800',
  },
  footerCloseBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerCloseBtnText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
});
