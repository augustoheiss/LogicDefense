/**
 * Page: view
 *
 * Sekundo — Simultaneous Multi-User E2EE Spreadsheet Viewer & Collaborative Console.
 *
 * Enforces:
 * 1. Out-of-Band AES-256-GCM Decryption (`decodeToken`).
 * 2. First-Time Registration Confirmation Gate (`IdentityAdmissionGateModal`):
 *    - Requires Full Name (`Nome Completo`), Operational Group (`Grupo`), and `PIN` on first access.
 *    - Blocks anyone not registered in the Privilege List (`UNAUTHORIZED`).
 *    - Persists a Trusted Device Session locally so returning users don't re-type credentials every time.
 *    - Provides explicit Logout (`🚪 Sair / Trocar Pessoa`) and Quick PIN Lock (`🔒 Bloquear PIN`).
 * 3. Strict Permission Hierarchy (`👑 Selo Admin` vs `👁️ Somente Consulta`):
 *    - Only participants with `👑 Selo Admin` (`hasAdminSeal === true`) can edit or export spreadsheets.
 *    - Other credited participants can consult any spreadsheet (`Geral`, `Programação`, `Territórios`, `Privilégios`),
 *      but have zero permission to edit or export.
 * 4. Simultaneous 1:N Encrypted Sync + Immutable Hash-Chained Activity Log (`ActivityLogModal`).
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import {
  decodeToken,
  extractTokenFromURL,
  extractRoomFromURL,
  encrypt,
  decrypt,
  skeletonTree,
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  ensureParticipantPrivilegeMatrix,
  revalidateSavedSessionPrincipal,
  canPerformSpreadsheetAction,
  selectEnginePartitionNodes,
  exportOmniCsvBundle,
  type HorizonPayload,
  type FlatSkeletonEntry,
  type NodeType,
  type ParticipantProfile,
  type AuthenticatedSessionPrincipal,
  type AdmissionVerificationResult,
  type ActivityLogEntry,
  type CreateActivityLogInput,
} from '@sekundo/core';
import { TreeView } from '../components/ui/TreeView';
import { AddressEditModal } from '../components/territory/AddressEditModal';
import { PrivilegeMatrixModal } from '../components/PrivilegeMatrixModal';
import { IdentityAdmissionGateModal } from '../components/auth/IdentityAdmissionGateModal';
import { ActivityLogModal } from '../components/audit/ActivityLogModal';
import { usePeerChat } from '../hooks/usePeerChat';
import { useSimultaneousCollab } from '../hooks/useSimultaneousCollab';
import {
  loadTrustedSessionPrincipal,
  saveTrustedSessionPrincipal,
  clearTrustedSessionPrincipal,
  lockTrustedDeviceSession,
  unlockTrustedDeviceSession,
  recordPersistedActivityEvent,
  mergeAndSaveActivityLog,
} from '../storage/activityLogStore';
import { storage } from '../storage/localStorage';

type ConsultSheetTab = 'ALL' | 'SCHEDULE' | 'TERRITORY' | 'PRIVILEGES';

export default function TokenViewer() {
  const params = useLocalSearchParams();
  const dataParam = typeof params.data === 'string' ? params.data : '';
  const roomParam = typeof params.room === 'string' ? params.room : '';

  const [tokenInput, setTokenInput] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [payload, setPayload] = useState<HorizonPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Governance: Privilege List, Trusted Session Principal & Activity Log
  const [privilegeRoster, setPrivilegeRoster] = useState<ParticipantProfile[]>([]);
  const [principal, setPrincipal] = useState<AuthenticatedSessionPrincipal | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [activeSheetTab, setActiveSheetTab] = useState<ConsultSheetTab>('ALL');
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);
  const [showPrivilegeMatrixModal, setShowPrivilegeMatrixModal] = useState(false);

  // Node editing modal states (Admin Seal only)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingNode, setEditingNode] = useState<FlatSkeletonEntry | null>(null);
  const [editingAddressItem, setEditingAddressItem] = useState<FlatSkeletonEntry | null>(null);
  const [nodeKey, setNodeKey] = useState('');
  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeType, setNodeType] = useState<NodeType>('slot');
  const [nodeEmail, setNodeEmail] = useState('');
  const [, setParentNodeKey] = useState<string | null>(null);

  // Auto-resolve token on param load or browser hash/query
  useEffect(() => {
    if (dataParam) {
      setTokenInput(dataParam);
      return;
    }
    if (typeof window !== 'undefined' && window.location?.href) {
      const fromHref = extractTokenFromURL(window.location.href);
      if (fromHref) {
        setTokenInput(fromHref);
      }
    }
  }, [dataParam]);

  const extractedRoomFromInput = useMemo(() => {
    const fromInput = extractRoomFromURL(tokenInput);
    if (fromInput) return fromInput;
    if (typeof window !== 'undefined' && window.location?.href) {
      return extractRoomFromURL(window.location.href) || '';
    }
    return '';
  }, [tokenInput]);

  const effectiveRoomId = useMemo(
    () =>
      roomParam ||
      extractedRoomFromInput ||
      payload?.roomId ||
      (payload ? `rm_${payload.eventName}` : ''),
    [roomParam, extractedRoomFromInput, payload]
  );

  const eventScopeId = useMemo(
    () => payload?.eventId || payload?.eventName || 'shared-session',
    [payload]
  );

  // Strict RBAC capability checks derived from Privilege List + Admin Seal
  const isSessionUnlocked = Boolean(principal && !principal.isPinLocked);
  const canEdit = useMemo(
    () => canPerformSpreadsheetAction(principal, 'EDIT_SPREADSHEET'),
    [principal]
  );
  const canExport = useMemo(
    () => canPerformSpreadsheetAction(principal, 'EXPORT_SPREADSHEET'),
    [principal]
  );

  // Persist modifications encrypted locally on the user's device only (zero server storage)
  const triggerAutoSave = async (
    updatedSkeleton: FlatSkeletonEntry[],
    updatedRoster?: ParticipantProfile[],
    updatedLog?: ActivityLogEntry[]
  ) => {
    if (!payload || !passphrase.trim()) return;
    try {
      const updatedPayload: HorizonPayload = {
        ...payload,
        skeleton: updatedSkeleton,
        privilegeRoster: updatedRoster ?? privilegeRoster,
        activityLog: updatedLog ?? activityLog,
      };
      const rawPayload = JSON.stringify(updatedPayload);
      const encryptedData = await encrypt(rawPayload, passphrase.trim());
      const localKey = `sekundo:viewer-cache:${effectiveRoomId || payload.eventName}`;
      await storage.setItem(localKey, encryptedData);
    } catch (err) {
      console.error('[Sekundo] Local encrypted cache save failed:', err);
    }
  };

  // Simultaneous 1:N Zero-Knowledge Collaboration Hook
  const {
    syncStatus,
    onlinePeers,
    onlineCount,
    broadcastSkeletonSnapshot,
    broadcastActivityEntries,
  } = useSimultaneousCollab({
    roomId: isSessionUnlocked ? effectiveRoomId : '',
    eventId: eventScopeId,
    passphrase: passphrase.trim(),
    principal: isSessionUnlocked ? principal : null,
    skeleton: payload?.skeleton || [],
    privilegeRoster,
    activityLog,
    activeSheet: activeSheetTab,
    onSkeletonUpdated: (nextSkeleton: FlatSkeletonEntry[]) => {
      setPayload((prev) => (prev ? { ...prev, skeleton: nextSkeleton } : null));
      triggerAutoSave(nextSkeleton, privilegeRoster, activityLog);
    },
    onRosterUpdated: (nextRoster: ParticipantProfile[]) => {
      const normalizedRoster = nextRoster.map((p, idx) =>
        ensureParticipantPrivilegeMatrix(p, idx)
      );
      setPrivilegeRoster(normalizedRoster);
      setPrincipal((prevPrincipal) => {
        if (!prevPrincipal) return null;
        const check = revalidateSavedSessionPrincipal(prevPrincipal, normalizedRoster);
        return check.allowed && check.principal ? check.principal : null;
      });
    },
    onActivityLogUpdated: (nextLog: ActivityLogEntry[]) => {
      setActivityLog(nextLog);
      mergeAndSaveActivityLog(eventScopeId, nextLog);
    },
  });

  // Legacy 1:1 WebRTC P2P Sync hook (kept as secondary transport ONLY when RBAC roster is absent)
  const {
    connectionState,
    joinViewerHandshake,
    broadcastState,
    closeConnection,
  } = usePeerChat({
    eventId: payload ? payload.eventName : 'viewer-session',
    role: 'viewer',
    onStateUpdate: (incomingSkeleton) => {
      if (payload && privilegeRoster.length === 0) {
        setPayload((prev) => (prev ? { ...prev, skeleton: incomingSkeleton } : null));
      }
    },
  });

  useEffect(() => {
    if (payload && roomParam && connectionState === 'disconnected' && isSessionUnlocked) {
      joinViewerHandshake(roomParam);
    }
  }, [payload, roomParam, isSessionUnlocked]);

  const appendAndBroadcastLog = async (
    input: Omit<CreateActivityLogInput, 'eventId'>
  ) => {
    const { entry, updatedLog } = await recordPersistedActivityEvent({
      ...input,
      eventId: eventScopeId,
    });
    setActivityLog(updatedLog);
    await broadcastActivityEntries([entry]);
    return { entry, updatedLog };
  };

  const handleDecrypt = async () => {
    const rawToken = tokenInput.trim();
    const cleanPass = passphrase.trim();
    if (!rawToken || !cleanPass) return;

    const token = extractTokenFromURL(rawToken) || rawToken;

    setDecrypting(true);
    setErrorMsg(null);
    try {
      let activePayload = await decodeToken(token, cleanPass);

      // Check local device encrypted cache for this session
      const localKey = `sekundo:viewer-cache:${
        roomParam || activePayload.roomId || activePayload.eventName
      }`;
      try {
        const cachedCipher = await storage.getItem(localKey);
        if (cachedCipher) {
          const decryptedStr = await decrypt(cachedCipher, cleanPass);
          const cachedPayload = JSON.parse(decryptedStr) as HorizonPayload;
          activePayload = {
            ...activePayload,
            skeleton: cachedPayload.skeleton || activePayload.skeleton,
            privilegeRoster:
              cachedPayload.privilegeRoster || activePayload.privilegeRoster,
            activityLog: cachedPayload.activityLog || activePayload.activityLog,
          };
        }
      } catch {
        // Fallback to direct token payload
      }

      const resolvedRoster = (
        activePayload.privilegeRoster && activePayload.privilegeRoster.length > 0
          ? activePayload.privilegeRoster
          : DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
      ).map((p, idx) => ensureParticipantPrivilegeMatrix(p, idx));

      setPrivilegeRoster(resolvedRoster);

      // Merge embedded Activity Log with local persisted Activity Log
      const scopeId = activePayload.eventId || activePayload.eventName || 'shared-session';
      const mergedLog = await mergeAndSaveActivityLog(
        scopeId,
        activePayload.activityLog || []
      );
      setActivityLog(mergedLog);
      setPayload(activePayload);

      // Check if this device already has a Trusted Session Principal (First-Time Only policy)
      const savedPrincipal = await loadTrustedSessionPrincipal(scopeId, resolvedRoster);
      if (savedPrincipal) {
        await saveTrustedSessionPrincipal(scopeId, savedPrincipal);
        setPrincipal(savedPrincipal);
        if (!savedPrincipal.isPinLocked) {
          const { updatedLog } = await recordPersistedActivityEvent({
            eventId: scopeId,
            actorId: savedPrincipal.participantId,
            actorName: savedPrincipal.fullName,
            actorGroup: savedPrincipal.groupTag,
            actorRole: savedPrincipal.role,
            actionType: 'SESSION_RESTORED',
            targetSheet: 'GERAL',
            summary: `Sessão confiável restaurada automaticamente no dispositivo (${
              savedPrincipal.hasAdminSeal ? '👑 Selo Admin' : '👁️ Consulta'
            }).`,
          });
          setActivityLog(updatedLog);
        }
      } else {
        setPrincipal(null);
      }
    } catch {
      setErrorMsg('Falha na descriptografia. Verifique a senha secreta do link.');
    } finally {
      setDecrypting(false);
    }
  };

  // Called when user completes First-Time Registration Confirmation (Full Name + Group + PIN)
  const handleConfirmAdmission = async (confirmedSession: AuthenticatedSessionPrincipal) => {
    await saveTrustedSessionPrincipal(eventScopeId, confirmedSession);
    setPrincipal(confirmedSession);
    await appendAndBroadcastLog({
      actorId: confirmedSession.participantId,
      actorName: confirmedSession.fullName,
      actorGroup: confirmedSession.groupTag,
      actorRole: confirmedSession.role,
      actionType: 'IDENTITY_CONFIRMED',
      targetSheet: 'GERAL',
      summary: `Cadastro confirmado (${confirmedSession.fullName} • ${confirmedSession.groupTag}) — ${
        confirmedSession.hasAdminSeal ? '👑 Selo Admin (Edição/Exportação)' : '👁️ Somente Consulta'
      }.`,
    });
  };

  // Called when an unauthorized person tries to enter or fails confirmation
  const handleRejectedAttempt = async (
    result: AdmissionVerificationResult,
    attemptedName: string,
    attemptedGroup: string
  ) => {
    await appendAndBroadcastLog({
      actorId: 'unregistered',
      actorName: attemptedName || 'Desconhecido',
      actorGroup: attemptedGroup || 'Sem Grupo',
      actorRole: 'UNAUTHORIZED',
      actionType: 'IDENTITY_REJECTED',
      targetSheet: 'GERAL',
      summary: `Acesso bloqueado para "${attemptedName}" (${attemptedGroup}): ${
        result.errorMessage || 'não consta na Lista de Privilégios ou PIN inválido.'
      }`,
    });
  };

  // Explicit Logout ("🚪 Sair / Trocar Pessoa") for shared computers/phones
  const handleExplicitLogout = async () => {
    if (principal) {
      await appendAndBroadcastLog({
        actorId: principal.participantId,
        actorName: principal.fullName,
        actorGroup: principal.groupTag,
        actorRole: principal.role,
        actionType: 'SESSION_LOGOUT',
        targetSheet: 'GERAL',
        summary: `${principal.fullName} realizou Logout explícito (Sessão encerrada neste aparelho).`,
      });
    }
    await clearTrustedSessionPrincipal(eventScopeId);
    setPrincipal(null);
  };

  // Quick PIN Lock ("🔒 Bloquear c/ PIN")
  const handleQuickPinLock = async () => {
    if (!principal) return;
    const locked = await lockTrustedDeviceSession(eventScopeId, principal);
    setPrincipal(locked);
    await appendAndBroadcastLog({
      actorId: locked.participantId,
      actorName: locked.fullName,
      actorGroup: locked.groupTag,
      actorRole: locked.role,
      actionType: 'SESSION_PIN_LOCKED',
      targetSheet: 'GERAL',
      summary: `${locked.fullName} bloqueou temporariamente a sessão por PIN.`,
    });
  };

  const handleQuickPinUnlock = async (
    pinInput: string
  ): Promise<{ unlocked: boolean; errorMessage?: string }> => {
    if (!principal) {
      return { unlocked: false, errorMessage: 'Nenhuma sessão ativa para desbloquear.' };
    }
    const res = await unlockTrustedDeviceSession(eventScopeId, principal, pinInput);
    if (res.unlocked) {
      setPrincipal(res.principal);
      await appendAndBroadcastLog({
        actorId: res.principal.participantId,
        actorName: res.principal.fullName,
        actorGroup: res.principal.groupTag,
        actorRole: res.principal.role,
        actionType: 'SESSION_PIN_UNLOCKED',
        targetSheet: 'GERAL',
        summary: `${res.principal.fullName} desbloqueou a sessão via PIN rápido.`,
      });
    }
    return { unlocked: res.unlocked, errorMessage: res.errorMessage };
  };

  // Multi-Sheet Consultation Switcher (Viewers can consult any sheet; logged in Audit Log)
  const handleSelectSheetTab = async (tab: ConsultSheetTab) => {
    if (tab === 'PRIVILEGES') {
      setShowPrivilegeMatrixModal(true);
      if (principal) {
        await appendAndBroadcastLog({
          actorId: principal.participantId,
          actorName: principal.fullName,
          actorGroup: principal.groupTag,
          actorRole: principal.role,
          actionType: 'SHEET_VIEWED',
          targetSheet: 'PRIVILEGIOS',
          summary: `${principal.fullName} consultou a planilha Lista de Privilégios.`,
        });
      }
      return;
    }
    setActiveSheetTab(tab);
    if (principal) {
      const scopeMap: Record<ConsultSheetTab, string> = {
        ALL: 'GERAL',
        SCHEDULE: 'PROGRAMACAO',
        TERRITORY: 'TERRITORIOS',
        PRIVILEGES: 'PRIVILEGIOS',
      };
      await appendAndBroadcastLog({
        actorId: principal.participantId,
        actorName: principal.fullName,
        actorGroup: principal.groupTag,
        actorRole: principal.role,
        actionType: 'SHEET_VIEWED',
        targetSheet: scopeMap[tab],
        summary: `${principal.fullName} consultou a planilha ${scopeMap[tab]}.`,
      });
    }
  };

  // Node editing handlers (Strictly guarded by `canEdit` / `👑 Selo Admin`)
  const openAddChildModal = (parentKey: string) => {
    if (!canEdit || !principal) return;
    setParentNodeKey(parentKey);
    setEditingNode(null);
    const children =
      payload?.skeleton.filter(
        (item) =>
          item.key.startsWith(parentKey + '-') &&
          item.key.split('-').length === parentKey.split('-').length + 1
      ) || [];
    const nextIdx = children.length + 1;
    const padIdx = nextIdx < 10 ? `0${nextIdx}` : `${nextIdx}`;
    setNodeKey(`${parentKey}-${padIdx}`);
    setNodeLabel('');
    setNodeType('slot');
    setNodeEmail('');
    setEditModalVisible(true);
  };

  const openAddRootModal = () => {
    if (!canEdit || !principal) return;
    setParentNodeKey(null);
    setEditingNode(null);
    const roots = payload?.skeleton.filter((item) => !item.key.includes('-')) || [];
    const nextIdx = roots.length + 1;
    const padIdx = nextIdx < 10 ? `0${nextIdx}` : `${nextIdx}`;
    setNodeKey(padIdx);
    setNodeLabel('');
    setNodeType('header');
    setNodeEmail('');
    setEditModalVisible(true);
  };

  const openEditModal = (node: FlatSkeletonEntry) => {
    if (!canEdit || !principal) return;
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
      !!rawMeta.lat;

    if (isAddressNode) {
      setEditingAddressItem(node);
      return;
    }

    setParentNodeKey(null);
    setEditingNode(node);
    setNodeKey(node.key);
    setNodeLabel(node.label);
    setNodeType(node.type);
    setNodeEmail(node.email || '');
    setEditModalVisible(true);
  };

  const handleSaveNode = async () => {
    if (!payload || !canEdit || !principal) return;
    let newSkeleton = [...payload.skeleton];
    let updatedNode: FlatSkeletonEntry;
    const isEdit = Boolean(editingNode);
    const beforeSummary = editingNode
      ? `${editingNode.label} (${editingNode.value || ''})`
      : undefined;

    if (editingNode) {
      updatedNode = {
        ...editingNode,
        label: nodeLabel,
        type: nodeType,
        email: nodeEmail,
      };
      newSkeleton = newSkeleton.map((item) =>
        item.key === editingNode.key ? updatedNode : item
      );
    } else {
      updatedNode = {
        key: nodeKey,
        label: nodeLabel,
        type: nodeType,
        email: nodeEmail,
        value: '',
        meta: {},
      };
      newSkeleton.push(updatedNode);
    }

    setPayload({ ...payload, skeleton: newSkeleton });
    setEditModalVisible(false);

    const { entry, updatedLog } = await recordPersistedActivityEvent({
      eventId: eventScopeId,
      actorId: principal.participantId,
      actorName: principal.fullName,
      actorGroup: principal.groupTag,
      actorRole: principal.role,
      actionType: isEdit ? 'CELL_EDITED' : 'NODE_ADDED',
      targetSheet:
        activeSheetTab === 'SCHEDULE'
          ? 'PROGRAMACAO'
          : activeSheetTab === 'TERRITORY'
          ? 'TERRITORIOS'
          : 'GERAL',
      targetNodeKey: updatedNode.key,
      summary: `${principal.fullName} ${isEdit ? 'editou' : 'criou'} o item [${updatedNode.key}] "${updatedNode.label}".`,
      beforeValue: beforeSummary,
      afterValue: updatedNode.label,
    });
    setActivityLog(updatedLog);

    await broadcastSkeletonSnapshot(newSkeleton, privilegeRoster, [entry]);
    broadcastState(newSkeleton);
    await triggerAutoSave(newSkeleton, privilegeRoster, updatedLog);
  };

  const deleteNode = async (key: string) => {
    if (!payload || !canEdit || !principal) return;
    const targetNode = payload.skeleton.find((i) => i.key === key);
    const newSkeleton = payload.skeleton.filter(
      (item) => item.key !== key && !item.key.startsWith(key + '-')
    );

    setPayload({ ...payload, skeleton: newSkeleton });

    const { entry, updatedLog } = await recordPersistedActivityEvent({
      eventId: eventScopeId,
      actorId: principal.participantId,
      actorName: principal.fullName,
      actorGroup: principal.groupTag,
      actorRole: principal.role,
      actionType: 'NODE_DELETED',
      targetSheet: 'GERAL',
      targetNodeKey: key,
      summary: `${principal.fullName} removeu o item [${key}] "${targetNode?.label || key}".`,
    });
    setActivityLog(updatedLog);

    await broadcastSkeletonSnapshot(newSkeleton, privilegeRoster, [entry]);
    broadcastState(newSkeleton);
    await triggerAutoSave(newSkeleton, privilegeRoster, updatedLog);
  };

  // Admin-only Privilege Matrix update handler
  const handleUpdatePrivilegesLive = async (updatedRoster: ParticipantProfile[]) => {
    if (!canEdit || !principal || !payload) return;
    const normalized = updatedRoster.map((p, idx) => ensureParticipantPrivilegeMatrix(p, idx));
    setPrivilegeRoster(normalized);

    const { entry, updatedLog } = await recordPersistedActivityEvent({
      eventId: eventScopeId,
      actorId: principal.participantId,
      actorName: principal.fullName,
      actorGroup: principal.groupTag,
      actorRole: principal.role,
      actionType: 'PRIVILEGE_UPDATED',
      targetSheet: 'PRIVILEGIOS',
      summary: `${principal.fullName} atualizou a Lista de Privilégios / Selo Admin (${
        normalized.filter((p) => p.hasAdminSeal).length
      } Admins).`,
    });
    setActivityLog(updatedLog);

    await broadcastSkeletonSnapshot(payload.skeleton, normalized, [entry]);
    await triggerAutoSave(payload.skeleton, normalized, updatedLog);
  };

  // Admin-only Spreadsheet CSV Export handler
  const handleExportSpreadsheetCsv = async () => {
    if (!canExport || !principal || !payload) return;

    const scheduleNodes = selectEnginePartitionNodes(payload.skeleton, 'schedule');
    const territoryNodes = selectEnginePartitionNodes(payload.skeleton, 'territory');
    const csvContent = exportOmniCsvBundle({
      unitName: payload.eventName,
      scheduleRegistry: scheduleNodes.length > 0 ? scheduleNodes : payload.skeleton,
      territoryRegistry: territoryNodes,
      participants: privilegeRoster,
    });

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sekundo-planilha-${payload.eventName.replace(/\s+/g, '-').toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    await appendAndBroadcastLog({
      actorId: principal.participantId,
      actorName: principal.fullName,
      actorGroup: principal.groupTag,
      actorRole: principal.role,
      actionType: 'CSV_EXPORTED',
      targetSheet: 'GERAL',
      summary: `${principal.fullName} (👑 Selo Admin) exportou a planilha completa em CSV.`,
    });
  };

  const handleCloseLinkSession = () => {
    closeConnection();
    setPayload(null);
    setPassphrase('');
    setErrorMsg(null);
  };

  // Filtered nodes for the selected consultation spreadsheet tab
  const visibleNodesForTab = useMemo(() => {
    if (!payload) return [];
    if (activeSheetTab === 'SCHEDULE') {
      const sched = selectEnginePartitionNodes(payload.skeleton, 'schedule');
      return sched.length > 0 ? sched : payload.skeleton;
    }
    if (activeSheetTab === 'TERRITORY') {
      const terr = selectEnginePartitionNodes(payload.skeleton, 'territory');
      return terr.length > 0 ? terr : payload.skeleton;
    }
    return payload.skeleton;
  }, [payload, activeSheetTab]);

  const tree = useMemo(
    () => (isSessionUnlocked ? skeletonTree.buildTree(visibleNodesForTab) : []),
    [isSessionUnlocked, visibleNodesForTab]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.card, payload && styles.largeCard]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.logo}>Sekundo • Colaboração Simultânea</Text>
              <Text style={styles.subtitle}>
                {!payload
                  ? 'Descriptografar Link Compartilhado E2EE'
                  : !isSessionUnlocked
                  ? '🔒 Aguardando Confirmação de Cadastro na Lista de Privilégios'
                  : canEdit
                  ? `👑 SELO ADMIN ATIVO (${principal?.fullName}) • EDIÇÃO & EXPORTAÇÃO LIBERADAS`
                  : `👁️ MODO SOMENTE CONSULTA (${principal?.fullName}) • EDIÇÃO E EXPORTAÇÃO BLOQUEADAS`}
              </Text>
            </View>

            {payload && isSessionUnlocked && principal && (
              <View style={styles.sessionPillRow}>
                {/* Online Peers Badge */}
                <Pressable
                  onPress={() => setShowActivityLogModal(true)}
                  style={styles.onlinePill}
                >
                  <Text style={styles.onlinePillText}>
                    🟢 {onlineCount} online • {syncStatus === 'live' ? 'E2EE Live' : 'Local'}
                  </Text>
                </Pressable>

                {/* Role Badge */}
                <View
                  style={[
                    styles.roleBadge,
                    canEdit ? styles.roleBadgeAdmin : styles.roleBadgeViewer,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleBadgeText,
                      canEdit ? { color: '#FDE68A' } : { color: '#BAE6FD' },
                    ]}
                  >
                    {canEdit ? '👑 SELO ADMIN' : '👁️ CONSULTA'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {!payload ? (
          <View style={styles.form}>
            {/* Token Input */}
            <Text style={styles.label}>COLE O LINK COMPARTILHADO OU TOKEN E2EE</Text>
            <TextInput
              style={styles.input}
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="https://sekundo.app/view?room=rm_...#data=..."
              placeholderTextColor="#4F5E74"
            />

            {/* Passphrase Input */}
            <Text style={[styles.label, { marginTop: 20 }]}>SENHA DE CRIPTOGRAFIA DA SALA</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="Digite a senha recebida da coordenação"
              placeholderTextColor="#4F5E74"
            />

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <Pressable
              onPress={handleDecrypt}
              disabled={!tokenInput.trim() || !passphrase.trim() || decrypting}
              style={[
                styles.primaryBtn,
                (!tokenInput.trim() || !passphrase.trim() || decrypting) && styles.btnDisabled,
              ]}
            >
              {decrypting ? (
                <ActivityIndicator size="small" color="#12151C" />
              ) : (
                <Text style={styles.primaryBtnText}>🔓 Descriptografar Planilha</Text>
              )}
            </Pressable>
          </View>
        ) : !isSessionUnlocked ? (
          /* Zero-Leakage Shield while waiting for Identity Admission Gate or PIN Unlock */
          <View style={styles.lockedShieldBox}>
            <Text style={styles.lockedShieldIcon}>🛡️</Text>
            <Text style={styles.lockedShieldTitle}>
              Acesso Protegido pela Lista de Privilégios
            </Text>
            <Text style={styles.lockedShieldDesc}>
              Confirme seu Nome Completo, Grupo e PIN na janela de verificação para consultar a
              planilha. Pessoas não cadastradas na Lista de Privilégios não podem visualizar os dados.
            </Text>
          </View>
        ) : (
          <View style={styles.viewerWorkspace}>
            {/* Top Governance & Action Bar */}
            <View style={styles.metaBar}>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.metaTitle}>{payload.eventName}</Text>
                <Text style={styles.metaSub}>
                  👤 {principal?.fullName} ({principal?.groupTag}) • Sala: {effectiveRoomId}
                </Text>
              </View>

              <View style={styles.topButtonsWrap}>
                {/* Activity Log Button */}
                <Pressable
                  testID="viewer-btn-activity-log"
                  onPress={() => setShowActivityLogModal(true)}
                  style={[styles.actionBtn, { borderColor: '#38BDF8', backgroundColor: '#0C4A6E' }]}
                >
                  <Text style={[styles.actionBtnText, { color: '#E0F2FE' }]}>
                    📜 Log ({activityLog.length})
                  </Text>
                </Pressable>

                {/* Admin-Only Actions: + Add Root & Export CSV */}
                {canEdit && (
                  <Pressable
                    testID="viewer-btn-add-root"
                    onPress={openAddRootModal}
                    style={[styles.actionBtn, { borderColor: '#8B5CF6', backgroundColor: '#2E1065' }]}
                  >
                    <Text style={[styles.actionBtnText, { color: '#DDD6FE' }]}>+ Novo Item</Text>
                  </Pressable>
                )}

                {canExport && (
                  <Pressable
                    testID="viewer-btn-export-csv"
                    onPress={handleExportSpreadsheetCsv}
                    style={[styles.actionBtn, { borderColor: '#F59E0B', backgroundColor: '#78350F' }]}
                  >
                    <Text style={[styles.actionBtnText, { color: '#FEF3C7' }]}>
                      📤 Exportar CSV
                    </Text>
                  </Pressable>
                )}

                {/* Quick PIN Lock */}
                <Pressable
                  testID="viewer-btn-pin-lock"
                  onPress={handleQuickPinLock}
                  style={styles.actionBtn}
                >
                  <Text style={styles.actionBtnText}>🔒 Bloquear PIN</Text>
                </Pressable>

                {/* Explicit Logout ("Trocar Pessoa") */}
                <Pressable
                  testID="viewer-btn-logout"
                  onPress={handleExplicitLogout}
                  style={[styles.actionBtn, { borderColor: '#EF4444', backgroundColor: '#450A0A' }]}
                >
                  <Text style={[styles.actionBtnText, { color: '#FECACA' }]}>
                    🚪 Sair (Logout)
                  </Text>
                </Pressable>

                <Pressable onPress={handleCloseLinkSession} style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>✕ Fechar Link</Text>
                </Pressable>
              </View>
            </View>

            {/* Multi-Spreadsheet Consultation Bar (Viewers can consult any spreadsheet) */}
            <View style={styles.sheetTabsBar}>
              {(
                [
                  { id: 'ALL', label: `📋 Planilha Geral (${payload.skeleton.length})` },
                  { id: 'SCHEDULE', label: '📅 Programação' },
                  { id: 'TERRITORY', label: '🗺️ Territórios' },
                  {
                    id: 'PRIVILEGES',
                    label: `🛡️ Lista de Privilégios (${privilegeRoster.length})`,
                  },
                ] as const
              ).map((tab) => {
                const active = activeSheetTab === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => handleSelectSheetTab(tab.id)}
                    style={[styles.sheetTabBtn, active && styles.sheetTabBtnActive]}
                  >
                    <Text
                      style={[
                        styles.sheetTabBtnText,
                        active && styles.sheetTabBtnTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}

              {!canEdit && (
                <View style={styles.readOnlyNoticePill}>
                  <Text style={styles.readOnlyNoticeText}>
                    👁️ Consulta liberada em todas as planilhas • Edição e exportação restritas ao 👑 Selo Admin
                  </Text>
                </View>
              )}
            </View>

            {/* TreeView (Read-Write callbacks are strictly gated by `canEdit` / `👑 Selo Admin`) */}
            <ScrollView style={styles.treeScroll}>
              <View style={styles.treeWrapper}>
                <TreeView
                  nodes={tree}
                  onAddChild={canEdit ? openAddChildModal : undefined}
                  onEditNode={canEdit ? openEditModal : undefined}
                  onDeleteNode={canEdit ? deleteNode : undefined}
                />
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      {/* First-Time Registration Confirmation & Quick PIN Unlock Gate */}
      <IdentityAdmissionGateModal
        visible={Boolean(payload && (!principal || principal.isPinLocked))}
        eventName={payload?.eventName || 'Planilha Compartilhada Sekundo'}
        eventId={eventScopeId}
        privilegeRoster={privilegeRoster}
        lockedPrincipal={principal?.isPinLocked ? principal : null}
        onAdmissionConfirmed={handleConfirmAdmission}
        onAdmissionRejected={handleRejectedAttempt}
        onUnlockWithPin={handleQuickPinUnlock}
        onLogoutLockedUser={handleExplicitLogout}
      />

      {/* Live Activity Log & Online Peers Modal */}
      <ActivityLogModal
        visible={showActivityLogModal}
        onClose={() => setShowActivityLogModal(false)}
        eventName={payload?.eventName || 'Planilha Compartilhada'}
        entries={activityLog}
        onlinePeers={onlinePeers}
        currentPrincipal={principal}
        onExportLogRecorded={async () => {
          if (!principal) return;
          await appendAndBroadcastLog({
            actorId: principal.participantId,
            actorName: principal.fullName,
            actorGroup: principal.groupTag,
            actorRole: principal.role,
            actionType: 'CSV_EXPORTED',
            targetSheet: 'GERAL',
            summary: `${principal.fullName} exportou o Log de Atividades em CSV.`,
          });
        }}
      />

      {/* Privilege Matrix Consultation / Admin Governance Modal */}
      <PrivilegeMatrixModal
        visible={showPrivilegeMatrixModal}
        onClose={() => setShowPrivilegeMatrixModal(false)}
        participants={privilegeRoster}
        onChangeParticipants={handleUpdatePrivilegesLive}
        readOnly={!canEdit}
      />

      {/* Edit/Add Node Modal (Admin Seal only) */}
      <Modal
        animationType="fade"
        transparent
        visible={editModalVisible && canEdit}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingNode ? '👑 Editar Item da Planilha' : '👑 Adicionar Item'}
            </Text>

            <Text style={styles.modalLabel}>ENDEREÇO DE CHAVE (KEY)</Text>
            <TextInput
              style={[styles.input, editingNode && styles.inputReadOnly]}
              value={nodeKey}
              onChangeText={setNodeKey}
              editable={!editingNode}
              placeholder="ex: 01-01"
              placeholderTextColor="#4F5E74"
            />

            <Text style={[styles.modalLabel, { marginTop: 14 }]}>RÓTULO / CONTEÚDO</Text>
            <TextInput
              style={styles.input}
              value={nodeLabel}
              onChangeText={setNodeLabel}
              placeholder="ex: Coordenador da Sessão"
              placeholderTextColor="#4F5E74"
            />

            <Text style={[styles.modalLabel, { marginTop: 14 }]}>TIPO DE NÓ</Text>
            <View style={styles.typeRow}>
              {(['header', 'slot', 'territory', 'note'] as NodeType[]).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setNodeType(type)}
                  style={[styles.typeBtn, nodeType === type && styles.typeBtnActive]}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      nodeType === type && styles.typeBtnTextActive,
                    ]}
                  >
                    {type.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            {nodeType === 'slot' ? (
              <>
                <Text style={[styles.modalLabel, { marginTop: 14 }]}>
                  RESPONSÁVEL / OBSERVAÇÃO (Opcional)
                </Text>
                <TextInput
                  style={styles.input}
                  value={nodeEmail}
                  onChangeText={setNodeEmail}
                  placeholder="responsavel@equipe"
                  placeholderTextColor="#4F5E74"
                />
              </>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable onPress={handleSaveNode} style={styles.modalPrimaryBtn}>
                <Text style={styles.modalPrimaryBtnText}>Salvar e Sincronizar</Text>
              </Pressable>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Address Edit Full Modal (Admin Seal only) */}
      <AddressEditModal
        visible={!!editingAddressItem && canEdit}
        item={editingAddressItem}
        onClose={() => setEditingAddressItem(null)}
        onSave={async (key, updates) => {
          if (!payload || !canEdit || !principal) return;
          const newSkeleton = payload.skeleton.map((item) => {
            if (item.key !== key) return item;
            return {
              ...item,
              label: updates.label,
              value: updates.value ?? item.value,
              meta: { ...item.meta, ...updates.meta },
            };
          });
          setPayload({ ...payload, skeleton: newSkeleton });

          const { entry, updatedLog } = await recordPersistedActivityEvent({
            eventId: eventScopeId,
            actorId: principal.participantId,
            actorName: principal.fullName,
            actorGroup: principal.groupTag,
            actorRole: principal.role,
            actionType: 'CELL_EDITED',
            targetSheet: 'TERRITORIOS',
            targetNodeKey: key,
            summary: `${principal.fullName} atualizou o território [${key}] "${updates.label}".`,
          });
          setActivityLog(updatedLog);

          await broadcastSkeletonSnapshot(newSkeleton, privilegeRoster, [entry]);
          broadcastState(newSkeleton);
          await triggerAutoSave(newSkeleton, privilegeRoster, updatedLog);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    display: 'flex',
    flexDirection: 'column',
  },
  largeCard: {
    maxWidth: 1180,
    height: '100%',
    maxHeight: 860,
  },
  header: {
    marginBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#FFB800',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: 0.3,
  },
  sessionPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlinePill: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  onlinePillText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '800',
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  roleBadgeAdmin: {
    backgroundColor: '#78350F',
    borderColor: '#F59E0B',
  },
  roleBadgeViewer: {
    backgroundColor: '#0C4A6E',
    borderColor: '#38BDF8',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#090D16',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#FFFFFF',
    padding: 13,
    fontSize: 14,
    width: '100%',
  },
  inputReadOnly: {
    backgroundColor: '#1E293B',
    color: '#94A3B8',
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  btnDisabled: {
    backgroundColor: '#1E293B',
  },
  primaryBtnText: {
    color: '#090D16',
    fontWeight: '800',
    fontSize: 15,
  },
  lockedShieldBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#090D16',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 10,
  },
  lockedShieldIcon: {
    fontSize: 40,
  },
  lockedShieldTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  lockedShieldDesc: {
    color: '#94A3B8',
    fontSize: 12.5,
    textAlign: 'center',
    maxWidth: 460,
    lineHeight: 18,
  },
  viewerWorkspace: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  metaBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 12,
    marginBottom: 10,
    gap: 10,
  },
  metaTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  metaSub: {
    color: '#94A3B8',
    fontSize: 11.5,
    marginTop: 2,
  },
  topButtonsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionBtnText: {
    color: '#E2E8F0',
    fontSize: 11.5,
    fontWeight: '700',
  },
  sheetTabsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  sheetTabBtn: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sheetTabBtnActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#60A5FA',
  },
  sheetTabBtnText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  sheetTabBtnTextActive: {
    color: '#FFFFFF',
  },
  readOnlyNoticePill: {
    marginLeft: 'auto',
    backgroundColor: '#0C4A6E',
    borderWidth: 1,
    borderColor: '#0284C7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  readOnlyNoticeText: {
    color: '#BAE6FD',
    fontSize: 10.5,
    fontWeight: '700',
  },
  treeScroll: {
    flex: 1,
  },
  treeWrapper: {
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 22,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalPrimaryBtn: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalCancelBtnText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 13,
  },
  typeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: '#090D16',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  typeBtnActive: {
    backgroundColor: '#2E1065',
    borderColor: '#8B5CF6',
  },
  typeBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  typeBtnTextActive: {
    color: '#DDD6FE',
  },
});
