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
  transferAddressesBetweenTerritories,
  formatShareTerritoryOrQuadraLocationsText,
  resolveTerritoryNumber,
  type FlatSkeletonEntry,
} from '@sekundo/core';
import {
  exportUpdatedTerritoryModelCsvFromStorage,
  triggerCsvFileDownloadOrCopy,
  shareLocationPayload,
  loadTerritoryRegistryBackupSnapshot,
} from '../../storage/omniStorageBridge';
import { openExternalGoogleMaps } from '../../hooks/useLiveGpsLocation';

export type TerritoryManageTab =
  | 'edit'
  | 'transfer_addresses'
  | 'new_territory'
  | 'new_address'
  | 'share_export';

export interface TerritoryManageModalProps {
  visible: boolean;
  initialTab?: TerritoryManageTab;
  targetTerritoryNumber?: string;
  targetGroupKey?: string;
  targetGroupLabel?: string;
  targetAddressKey?: string;
  cleanNodes: FlatSkeletonEntry[];
  onClose: () => void;
  onCommitNodes: (
    nextCleanNodes: FlatSkeletonEntry[],
    metaInfo?: { activeTerritoryNumber?: string; message?: string }
  ) => Promise<void>;
}

function normalizeSearchToken(val: string): string {
  return (val || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function TerritoryManageModal({
  visible,
  initialTab = 'edit',
  targetTerritoryNumber,
  targetGroupKey,
  targetGroupLabel,
  targetAddressKey,
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
  const [shareIncludeNotes, setShareIncludeNotes] = useState(false);
  const [selectedShareTerritories, setSelectedShareTerritories] = useState<string[]>([
    effectiveTargetTerritory,
  ]);
  const [shareFilterQuery, setShareFilterQuery] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  // --- Tab 5: Transfer Addresses Between Territories State ---
  const [transferSourceTerritory, setTransferSourceTerritory] = useState(effectiveTargetTerritory);
  const [transferScopeMode, setTransferScopeMode] = useState<'all_from_territory' | 'selected'>(
    targetAddressKey ? 'selected' : 'all_from_territory'
  );
  const [selectedTransferKeys, setSelectedTransferKeys] = useState<string[]>(
    targetAddressKey ? [targetAddressKey] : []
  );
  const [transferAddressFilterQuery, setTransferAddressFilterQuery] = useState('');
  const [transferDestTerritory, setTransferDestTerritory] = useState('');
  const [transferDestFilterQuery, setTransferDestFilterQuery] = useState('');
  const [transferCreateNewDest, setTransferCreateNewDest] = useState(false);
  const [transferNewDestNumber, setTransferNewDestNumber] = useState('');
  const [transferNewDestName, setTransferNewDestName] = useState('');
  const [transferDeleteEmptySource, setTransferDeleteEmptySource] = useState(false);

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
    const suggestedNextNum = String(maxNum + 1).padStart(2, '0');
    setNewTerrNumber(suggestedNextNum);
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

    // Initialize Transfer tab state
    setTransferSourceTerritory(tNum);
    if (targetAddressKey) {
      setTransferScopeMode('selected');
      setSelectedTransferKeys([targetAddressKey]);
    } else {
      setTransferScopeMode('all_from_territory');
      setSelectedTransferKeys([]);
    }
    setTransferAddressFilterQuery('');
    const otherTerr = summaries.find((s) => s.territoryNumber !== tNum)?.territoryNumber || suggestedNextNum;
    setTransferDestTerritory(otherTerr);
    setTransferDestFilterQuery('');
    setTransferCreateNewDest(summaries.length <= 1);
    setTransferNewDestNumber(suggestedNextNum);
    setTransferNewDestName('');
    setTransferDeleteEmptySource(false);

    setShareFilterQuery('');
    setSelectedShareTerritories((prev) => (prev.length > 0 ? prev : [tNum]));
  }, [
    visible,
    initialTab,
    effectiveTargetTerritory,
    targetGroupKey,
    targetGroupLabel,
    targetAddressKey,
    summaries,
    cleanNodes,
  ]);

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

  // Leaf addresses belonging to `transferSourceTerritory`
  const sourceTerritoryLeafAddresses = useMemo(() => {
    const parentKeys = new Set<string>();
    for (const item of cleanNodes) {
      const segs = item.key.replace(/^(90-|T::)/, '').split('-');
      if (segs.length >= 2) {
        parentKeys.add(segs[0]);
      }
    }
    return cleanNodes.filter((n) => {
      const tNum = resolveTerritoryNumber(n);
      if (tNum !== transferSourceTerritory) return false;
      const cleanKey = n.key.replace(/^(90-|T::)/, '');
      const segs = cleanKey.split('-');
      const isHeader = parentKeys.has(cleanKey) || (segs.length === 1 && n.type === 'header');
      return !isHeader;
    });
  }, [cleanNodes, transferSourceTerritory]);

  const filteredSourceLeafAddresses = useMemo(() => {
    const q = normalizeSearchToken(transferAddressFilterQuery);
    if (!q) return sourceTerritoryLeafAddresses;
    return sourceTerritoryLeafAddresses.filter((item) => {
      const hay = normalizeSearchToken(
        [
          item.key,
          item.label,
          item.meta?.line,
          item.meta?.street,
          item.meta?.number,
          item.meta?.neighborhood,
          item.meta?.notes,
        ]
          .filter(Boolean)
          .join(' ')
      );
      return hay.includes(q);
    });
  }, [sourceTerritoryLeafAddresses, transferAddressFilterQuery]);

  const filteredDestSummaries = useMemo(() => {
    const q = normalizeSearchToken(transferDestFilterQuery);
    return summaries.filter((s) => {
      if (s.territoryNumber === transferSourceTerritory) return false;
      if (!q) return true;
      const hay = normalizeSearchToken(
        [s.territoryNumber, `T${s.territoryNumber}`, s.territoryName, s.subtitle, s.city, s.searchBlob]
          .filter(Boolean)
          .join(' ')
      );
      return hay.includes(q);
    });
  }, [summaries, transferSourceTerritory, transferDestFilterQuery]);

  const filteredShareSummaries = useMemo(() => {
    const q = normalizeSearchToken(shareFilterQuery);
    if (!q) return summaries;
    return summaries.filter((s) => {
      const hay = normalizeSearchToken(
        [
          s.territoryNumber,
          `T${s.territoryNumber}`,
          `Territorio ${s.territoryNumber}`,
          s.territoryName,
          s.subtitle,
          s.city,
          s.searchBlob,
        ]
          .filter(Boolean)
          .join(' ')
      );
      return hay.includes(q);
    });
  }, [summaries, shareFilterQuery]);

  const handleExecuteTransfer = async () => {
    const destNum = transferCreateNewDest
      ? transferNewDestNumber.trim()
      : transferDestTerritory.trim();
    if (!destNum) {
      setFeedback('⚠️ Selecione ou digite o número do Território de Destino.');
      return;
    }
    if (destNum === transferSourceTerritory && !transferCreateNewDest) {
      setFeedback('⚠️ O território de destino deve ser diferente do território de origem.');
      return;
    }
    if (transferScopeMode === 'selected' && selectedTransferKeys.length === 0) {
      setFeedback('⚠️ Marque pelo menos 1 endereço na lista para transferir.');
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const result = transferAddressesBetweenTerritories(cleanNodes, {
        mode: transferScopeMode === 'all_from_territory' ? 'all_from_territory' : 'selected',
        sourceTerritoryNumber: transferSourceTerritory,
        sourceNodeKeys: transferScopeMode === 'selected' ? selectedTransferKeys : undefined,
        destinationTerritoryNumber: destNum,
        destinationTerritoryName: transferCreateNewDest
          ? transferNewDestName.trim() || undefined
          : undefined,
        emptySourcePolicy: transferDeleteEmptySource ? 'delete_source' : 'keep_header',
      });

      if (result.transferredCount === 0) {
        setFeedback('⚠️ Nenhum endereço encontrado para transferir neste filtro.');
        setBusy(false);
        return;
      }

      await onCommitNodes(result.nodes, {
        activeTerritoryNumber: result.destinationTerritoryNumber,
        message: `✓ ${result.transferredCount} endereço(s) transferido(s) do Território ${result.sourceTerritoryNumber} para o Território ${result.destinationTerritoryNumber} (salvo em LocalStorage + IndexedDB)!`,
      });

      setFeedback(
        `✓ Transferência concluída! ${result.transferredCount} endereço(s) movido(s) do Território ${result.sourceTerritoryNumber} para o Território ${result.destinationTerritoryNumber}. Ao exportar a planilha CSV, os endereços já sairão no Território ${result.destinationTerritoryNumber}!`
      );
      setSelectedTransferKeys([]);
      setSelectedEditTerritory(result.destinationTerritoryNumber);
      setSelectedShareTerritories([result.destinationTerritoryNumber]);
    } catch (err: any) {
      setFeedback(`⚠️ Erro ao transferir endereços: ${err?.message || 'Falha desconhecida'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleUndoLastBackup = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const backupNodes = await loadTerritoryRegistryBackupSnapshot();
      if (!backupNodes || backupNodes.length === 0) {
        setFeedback('⚠️ Nenhum snapshot anterior encontrado para desfazer.');
        setBusy(false);
        return;
      }
      await onCommitNodes(backupNodes, {
        message: '⏪ Backup anterior restaurado com sucesso na memória!',
      });
      setFeedback('⏪ Alteração desfeita! Estado anterior restaurado na memória.');
    } catch (err: any) {
      setFeedback(`⚠️ Erro ao restaurar backup: ${err?.message || 'Falha desconhecida'}`);
    } finally {
      setBusy(false);
    }
  };

  // Share preview for the selected territories (supports multi-territory selection)
  const sharePayload = useMemo(() => {
    const activeTerrs =
      selectedShareTerritories.length > 0
        ? selectedShareTerritories
        : [selectedEditTerritory || effectiveTargetTerritory];

    if (activeTerrs.length === 1) {
      const tNum = activeTerrs[0];
      const tNodes = cleanNodes.filter((n) => resolveTerritoryNumber(n) === tNum);
      return formatShareTerritoryOrQuadraLocationsText({
        territoryNumber: tNum,
        territoryName: editTerritoryName || resolveTerritoryNameFromNodes(cleanNodes, tNum),
        quadraKey: editScope === 'quadra' && targetGroupKey ? targetGroupKey : undefined,
        quadraLabel: editScope === 'quadra' && targetGroupLabel ? targetGroupLabel : undefined,
        items: tNodes.length > 0 ? tNodes : cleanNodes,
        city: editCity,
        onlyPending: shareOnlyPending,
        includeNotes: shareIncludeNotes,
      });
    }

    const payloads = activeTerrs.map((tNum) => {
      const tNodes = cleanNodes.filter((n) => resolveTerritoryNumber(n) === tNum);
      return formatShareTerritoryOrQuadraLocationsText({
        territoryNumber: tNum,
        territoryName: resolveTerritoryNameFromNodes(cleanNodes, tNum),
        items: tNodes,
        city: editCity,
        onlyPending: shareOnlyPending,
        includeNotes: shareIncludeNotes,
      });
    });

    const combinedText = payloads.map((p) => p.text).join('\n\n────────────────────\n\n');
    const combinedTitle = `Territórios ${activeTerrs.join(', ')}`;
    return {
      title: combinedTitle,
      text: combinedText,
      mapsUrl: payloads[0]?.mapsUrl || '',
      whatsappUrl: `https://wa.me/?text=${encodeURIComponent(combinedText)}`,
    };
  }, [
    cleanNodes,
    selectedShareTerritories,
    selectedEditTerritory,
    effectiveTargetTerritory,
    editTerritoryName,
    editScope,
    targetGroupKey,
    targetGroupLabel,
    editCity,
    shareOnlyPending,
    shareIncludeNotes,
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
              testID="territory-manage-tab-transfer"
              onPress={() => {
                setActiveTab('transfer_addresses');
                setFeedback(null);
              }}
              style={[
                styles.tabBtn,
                activeTab === 'transfer_addresses' && styles.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'transfer_addresses' && styles.tabBtnTextActive,
                ]}
              >
                🔀 Transferir Endereços
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

            {/* ==================== TAB: TRANSFER ADDRESSES BETWEEN TERRITORIES ==================== */}
            {activeTab === 'transfer_addresses' ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  🔀 TRANSFERIR ENDEREÇO(S) OU TODO UM TERRITÓRIO PARA OUTRO TERRITÓRIO
                </Text>
                <Text style={styles.helperText}>
                  Transfira 1 endereço, vários endereços selecionados ou todos os endereços de um território para outro com 1 clique. O sistema salva automaticamente em LocalStorage e IndexedDB e já atualiza a planilha CSV na exportação!
                </Text>

                {/* Step 1: Source Territory */}
                <Text style={styles.label}>1. Escolha o Território de Origem (De onde sairão os endereços):</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
                >
                  {summaries.map((s) => {
                    const isSource = s.territoryNumber === transferSourceTerritory;
                    return (
                      <Pressable
                        key={`transfer-src-${s.territoryNumber}`}
                        testID={`transfer-source-territory-${s.territoryNumber}`}
                        onPress={() => {
                          setTransferSourceTerritory(s.territoryNumber);
                          setSelectedTransferKeys([]);
                          if (transferDestTerritory === s.territoryNumber) {
                            const alt = summaries.find((x) => x.territoryNumber !== s.territoryNumber);
                            if (alt) setTransferDestTerritory(alt.territoryNumber);
                          }
                        }}
                        style={[styles.terrChip, isSource && styles.terrChipActive]}
                      >
                        <Text style={[styles.terrChipText, isSource && styles.terrChipTextActive]}>
                          {isSource ? '📤 ' : ''}Território {s.territoryNumber}
                          {s.territoryName ? ` • ${s.territoryName}` : ''} ({s.totalAddresses} end.)
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Step 2: Scope (All vs Selected) */}
                <Text style={styles.label}>2. O que deseja transferir do Território {transferSourceTerritory}?</Text>
                <View style={styles.scopeRow}>
                  <Pressable
                    testID="transfer-scope-all-btn"
                    onPress={() => setTransferScopeMode('all_from_territory')}
                    style={[
                      styles.scopeBtn,
                      transferScopeMode === 'all_from_territory' && styles.scopeBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scopeBtnText,
                        transferScopeMode === 'all_from_territory' && styles.scopeBtnTextActive,
                      ]}
                    >
                      📦 Todos os Endereços ({sourceTerritoryLeafAddresses.length})
                    </Text>
                  </Pressable>

                  <Pressable
                    testID="transfer-scope-selected-btn"
                    onPress={() => setTransferScopeMode('selected')}
                    style={[
                      styles.scopeBtn,
                      transferScopeMode === 'selected' && styles.scopeBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scopeBtnText,
                        transferScopeMode === 'selected' && styles.scopeBtnTextActive,
                      ]}
                    >
                      ☑️ Selecionar Endereços ({selectedTransferKeys.length})
                    </Text>
                  </Pressable>
                </View>

                {transferScopeMode === 'selected' ? (
                  <View style={{ gap: 8 }}>
                    <TextInput
                      testID="transfer-address-filter-input"
                      style={styles.input}
                      value={transferAddressFilterQuery}
                      onChangeText={setTransferAddressFilterQuery}
                      placeholder="🔍 Filtrar endereço por rua, número ou observação..."
                      placeholderTextColor="#64748B"
                    />
                    <View style={styles.filterToolbarRow}>
                      <Text style={styles.filterCountBadge}>
                        ✓ {selectedTransferKeys.length} de {sourceTerritoryLeafAddresses.length} endereço(s) marcado(s)
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Pressable
                          onPress={() => {
                            const keysToSelect = filteredSourceLeafAddresses.map((a) =>
                              a.key.replace(/^(90-|T::)/, '')
                            );
                            setSelectedTransferKeys((prev) =>
                              Array.from(new Set([...prev, ...keysToSelect]))
                            );
                          }}
                          style={styles.miniFilterBtn}
                        >
                          <Text style={styles.miniFilterBtnText}>
                            ☑️ Marcar Filtrados ({filteredSourceLeafAddresses.length})
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setSelectedTransferKeys([])}
                          style={styles.miniFilterBtn}
                        >
                          <Text style={styles.miniFilterBtnText}>⬜ Limpar</Text>
                        </Pressable>
                      </View>
                    </View>

                    <ScrollView
                      style={styles.verticalListContainer}
                      contentContainerStyle={{ gap: 6 }}
                      nestedScrollEnabled
                    >
                      {filteredSourceLeafAddresses.length === 0 ? (
                        <Text style={styles.emptyListHint}>
                          Nenhum endereço encontrado neste território para o filtro digitado.
                        </Text>
                      ) : (
                        filteredSourceLeafAddresses.map((addr) => {
                          const cleanKey = addr.key.replace(/^(90-|T::)/, '');
                          const isChecked = selectedTransferKeys.includes(cleanKey);
                          const displayAddr = String(
                            addr.meta?.line || addr.label || cleanKey
                          ).trim();
                          const noteSnippet = String(addr.meta?.notes || '').trim();
                          return (
                            <Pressable
                              key={addr.key}
                              testID={`transfer-address-item-${cleanKey}`}
                              onPress={() => {
                                setSelectedTransferKeys((prev) =>
                                  prev.includes(cleanKey)
                                    ? prev.filter((k) => k !== cleanKey)
                                    : [...prev, cleanKey]
                                );
                              }}
                              style={[
                                styles.verticalCardItem,
                                isChecked && styles.verticalCardItemActive,
                              ]}
                            >
                              <View
                                style={[
                                  styles.verticalCheckBox,
                                  isChecked && styles.verticalCheckBoxActive,
                                ]}
                              >
                                <Text style={styles.verticalCheckIcon}>
                                  {isChecked ? '✓' : ''}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.verticalCardTitle}>{displayAddr}</Text>
                                {noteSnippet ? (
                                  <Text style={styles.verticalCardSub}>📝 {noteSnippet}</Text>
                                ) : null}
                              </View>
                              <Text style={styles.verticalCardBadge}>{cleanKey}</Text>
                            </Pressable>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                ) : null}

                {/* Step 3: Destination Territory */}
                <View style={styles.filterToolbarRow}>
                  <Text style={styles.label}>
                    3. Escolha o Território de Destino (Para onde vão os endereços):
                  </Text>
                  <Pressable
                    testID="transfer-toggle-new-dest-btn"
                    onPress={() => setTransferCreateNewDest((prev) => !prev)}
                    style={[styles.miniFilterBtn, transferCreateNewDest && styles.scopeBtnActive]}
                  >
                    <Text
                      style={[
                        styles.miniFilterBtnText,
                        transferCreateNewDest && styles.scopeBtnTextActive,
                      ]}
                    >
                      {transferCreateNewDest
                        ? '📋 Escolher Território Existente'
                        : '➕ Transferir p/ Novo Território'}
                    </Text>
                  </Pressable>
                </View>

                {transferCreateNewDest ? (
                  <View style={styles.row}>
                    <View style={{ flex: 1, minWidth: 120 }}>
                      <Text style={styles.label}>Novo Nº de Destino</Text>
                      <TextInput
                        testID="transfer-new-dest-number-input"
                        style={styles.input}
                        value={transferNewDestNumber}
                        onChangeText={setTransferNewDestNumber}
                        placeholder="Ex: 09 ou T09"
                        placeholderTextColor="#64748B"
                      />
                    </View>
                    <View style={{ flex: 2, minWidth: 200 }}>
                      <Text style={styles.label}>Nome / Bairro do Novo Destino</Text>
                      <TextInput
                        testID="transfer-new-dest-name-input"
                        style={styles.input}
                        value={transferNewDestName}
                        onChangeText={setTransferNewDestName}
                        placeholder="Ex: Jardim Paulista"
                        placeholderTextColor="#64748B"
                      />
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    <TextInput
                      testID="transfer-dest-filter-input"
                      style={styles.input}
                      value={transferDestFilterQuery}
                      onChangeText={setTransferDestFilterQuery}
                      placeholder="🔍 Filtrar território de destino por nº, nome ou descrição..."
                      placeholderTextColor="#64748B"
                    />
                    <ScrollView
                      style={styles.verticalListContainer}
                      contentContainerStyle={{ gap: 6 }}
                      nestedScrollEnabled
                    >
                      {filteredDestSummaries.map((dest) => {
                        const isDest = dest.territoryNumber === transferDestTerritory;
                        return (
                          <Pressable
                            key={`transfer-dest-${dest.territoryNumber}`}
                            testID={`transfer-dest-territory-${dest.territoryNumber}`}
                            onPress={() => setTransferDestTerritory(dest.territoryNumber)}
                            style={[
                              styles.verticalCardItem,
                              isDest && styles.verticalCardItemActive,
                            ]}
                          >
                            <View
                              style={[
                                styles.verticalCheckBox,
                                isDest && styles.verticalCheckBoxActive,
                              ]}
                            >
                              <Text style={styles.verticalCheckIcon}>{isDest ? '✓' : ''}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.verticalCardTitle}>
                                Território {dest.territoryNumber}
                                {dest.territoryName ? ` — ${dest.territoryName}` : ''}
                              </Text>
                              {dest.subtitle ? (
                                <Text style={styles.verticalCardSub}>{dest.subtitle}</Text>
                              ) : null}
                            </View>
                            <Text style={styles.verticalCardCount}>
                              {dest.totalAddresses} end.
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Optional cleanup toggle */}
                <Pressable
                  onPress={() => setTransferDeleteEmptySource((prev) => !prev)}
                  style={styles.checkboxToggleRow}
                >
                  <View
                    style={[
                      styles.verticalCheckBox,
                      transferDeleteEmptySource && styles.verticalCheckBoxActive,
                    ]}
                  >
                    <Text style={styles.verticalCheckIcon}>
                      {transferDeleteEmptySource ? '✓' : ''}
                    </Text>
                  </View>
                  <Text style={styles.helperText}>
                    Excluir o território de origem ({transferSourceTerritory}) caso todos os seus endereços sejam transferidos (se desmarcado, o território {transferSourceTerritory} continuará existindo vazio com 0 endereços).
                  </Text>
                </Pressable>

                {/* Primary Transfer Submit & Quick CSV / Undo */}
                <View style={styles.actionRow}>
                  <Pressable
                    testID="execute-transfer-addresses-btn"
                    disabled={busy}
                    onPress={handleExecuteTransfer}
                    style={[styles.primaryBtn, { flex: 2 }]}
                  >
                    {busy ? (
                      <ActivityIndicator color="#062016" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        🔀 Transferir{' '}
                        {transferScopeMode === 'all_from_territory'
                          ? `Todos (${sourceTerritoryLeafAddresses.length})`
                          : `${selectedTransferKeys.length} Endereço(s)`}{' '}
                        para Território{' '}
                        {transferCreateNewDest ? transferNewDestNumber : transferDestTerritory}
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    testID="transfer-undo-backup-btn"
                    disabled={busy}
                    onPress={handleUndoLastBackup}
                    style={styles.secondaryBtn}
                  >
                    <Text style={styles.secondaryBtnText}>⏪ Desfazer</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* ==================== TAB 4: SHARE LOCATIONS & EXPORT CSV ==================== */}
            {activeTab === 'share_export' ? (
              <>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>
                    📲 COMPARTILHAR LOCALIZAÇÕES DIRETO (FILTRO POR LISTA + MULTI-SELEÇÃO)
                  </Text>
                  <Text style={styles.helperText}>
                    Digite o número, nome, subtítulo ou descrição do território abaixo para filtrar a lista, marque um ou vários territórios e copie ou envie no WhatsApp com 1 clique.
                  </Text>

                  {/* Search Filter Input (Fixes teste02.png) */}
                  <TextInput
                    testID="share-territory-filter-input"
                    style={styles.input}
                    value={shareFilterQuery}
                    onChangeText={setShareFilterQuery}
                    placeholder="🔍 Filtrar por número (ex: T01), nome, subtítulo ou descrição..."
                    placeholderTextColor="#64748B"
                  />

                  <View style={styles.filterToolbarRow}>
                    <Text style={styles.filterCountBadge}>
                      ✓ {selectedShareTerritories.length} território(s) marcado(s) •{' '}
                      {filteredShareSummaries.length} visível(is)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <Pressable
                        testID="share-select-all-filtered-btn"
                        onPress={() => {
                          const nums = filteredShareSummaries.map((s) => s.territoryNumber);
                          setSelectedShareTerritories((prev) =>
                            Array.from(new Set([...prev, ...nums]))
                          );
                        }}
                        style={styles.miniFilterBtn}
                      >
                        <Text style={styles.miniFilterBtnText}>
                          ☑️ Marcar Filtrados ({filteredShareSummaries.length})
                        </Text>
                      </Pressable>
                      <Pressable
                        testID="share-clear-selection-btn"
                        onPress={() => setSelectedShareTerritories([effectiveTargetTerritory])}
                        style={styles.miniFilterBtn}
                      >
                        <Text style={styles.miniFilterBtnText}>⬜ Limpar</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Vertical Multi-Select Territory List (Fixes cramped horizontal strip in teste02.png) */}
                  <ScrollView
                    style={styles.verticalListContainer}
                    contentContainerStyle={{ gap: 6 }}
                    nestedScrollEnabled
                  >
                    {filteredShareSummaries.length === 0 ? (
                      <Text style={styles.emptyListHint}>
                        Nenhum território corresponde ao filtro "{shareFilterQuery}".
                      </Text>
                    ) : (
                      filteredShareSummaries.map((s) => {
                        const isSelected = selectedShareTerritories.includes(s.territoryNumber);
                        return (
                          <Pressable
                            key={s.territoryNumber}
                            testID={`share-select-territory-${s.territoryNumber}`}
                            onPress={() => {
                              handleSelectTerritoryToEdit(s.territoryNumber);
                              setSelectedShareTerritories((prev) => {
                                if (prev.includes(s.territoryNumber)) {
                                  return prev.length > 1
                                    ? prev.filter((item) => item !== s.territoryNumber)
                                    : prev;
                                }
                                return [...prev, s.territoryNumber];
                              });
                            }}
                            style={[
                              styles.verticalCardItem,
                              isSelected && styles.verticalCardItemActive,
                            ]}
                          >
                            <View
                              style={[
                                styles.verticalCheckBox,
                                isSelected && styles.verticalCheckBoxActive,
                              ]}
                            >
                              <Text style={styles.verticalCheckIcon}>
                                {isSelected ? '✓' : ''}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.verticalCardTitle}>
                                Território {s.territoryNumber}
                                {s.territoryName ? ` • ${s.territoryName}` : ''}
                              </Text>
                              {s.subtitle ? (
                                <Text style={styles.verticalCardSub} numberOfLines={2}>
                                  {s.subtitle}
                                </Text>
                              ) : null}
                            </View>
                            <Text style={styles.verticalCardCount}>
                              {s.workedAddresses}/{s.totalAddresses} end.
                            </Text>
                          </Pressable>
                        );
                      })
                    )}
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
                    <Pressable
                      testID="share-include-notes-toggle"
                      onPress={() => setShareIncludeNotes((prev) => !prev)}
                      style={[styles.scopeBtn, shareIncludeNotes && styles.scopeBtnActive]}
                    >
                      <Text
                        style={[
                          styles.scopeBtnText,
                          shareIncludeNotes && styles.scopeBtnTextActive,
                        ]}
                      >
                        {shareIncludeNotes ? '✓ Com Observações' : '🔒 Sem Observações'}
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
                        📥 Baixar Novo Modelo CSV de Territórios (Excel / Registro de Territórios)
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
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.18)',
    borderColor: '#FFB800',
  },
  tabBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
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
    flex: 1,
  },
  terrChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  terrChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  terrChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  terrChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  scopeBtn: {
    flex: 1,
    minWidth: 140,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  scopeBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
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
    textAlign: 'center',
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
    textAlign: 'center',
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
    textAlign: 'center',
  },
  dangerOutlineBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerOutlineBtnText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  dangerSolidBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerSolidBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  filterToolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterCountBadge: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  miniFilterBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniFilterBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  verticalListContainer: {
    maxHeight: 215,
    backgroundColor: '#0E131D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    padding: 8,
  },
  verticalCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  verticalCardItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderColor: '#38BDF8',
  },
  verticalCheckBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#64748B',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalCheckBoxActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  verticalCheckIcon: {
    color: '#061523',
    fontSize: 13,
    fontWeight: '900',
  },
  verticalCardTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  verticalCardSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  verticalCardBadge: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verticalCardCount: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  emptyListHint: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 14,
  },
  checkboxToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
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
