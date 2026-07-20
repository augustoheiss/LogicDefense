/**
 * Page: view
 *
 * Sovereign, read-only viewer console with optional administrative passphrase
 * escalation to Read-Write mode, real-time WebRTC P2P sync, and Render RAM cache backing.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { decodeToken, extractTokenFromURL, encrypt, decrypt } from '@sekundo/core';
import type { HorizonPayload, FlatSkeletonEntry, NodeType } from '@sekundo/core';
import { TreeView } from '../components/ui/TreeView';
import { skeletonTree } from '@sekundo/core';
import { usePeerChat } from '../hooks/usePeerChat';
import { API, getHeaders } from '../config/api';

export default function TokenViewer() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dataParam = typeof params.data === 'string' ? params.data : '';
  const roomParam = typeof params.room === 'string' ? params.room : '';

  const [tokenInput, setTokenInput] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [payload, setPayload] = useState<HorizonPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Administrative Escalation states
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [escalatePass, setEscalatePass] = useState('');
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateError, setEscalateError] = useState<string | null>(null);

  // Node editing modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingNode, setEditingNode] = useState<FlatSkeletonEntry | null>(null);
  const [nodeKey, setNodeKey] = useState('');
  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeType, setNodeType] = useState<NodeType>('slot');
  const [nodeEmail, setNodeEmail] = useState('');
  const [parentNodeKey, setParentNodeKey] = useState<string | null>(null);

  // Auto-resolve token on param load
  useEffect(() => {
    if (dataParam) {
      setTokenInput(dataParam);
    }
  }, [dataParam]);

  // WebRTC P2P Sync hook
  const {
    connectionState,
    startAdminHandshake,
    joinViewerHandshake,
    broadcastState,
    closeConnection,
  } = usePeerChat({
    eventId: payload ? payload.eventName : 'viewer-session',
    role: 'viewer',
    onStateUpdate: (incomingSkeleton) => {
      if (payload) {
        setPayload((prev) => (prev ? { ...prev, skeleton: incomingSkeleton } : null));
        console.log('[Sekundo P2P] Received live skeleton update.');
      }
    },
  });

  // Connect WebRTC if roomParam is present
  useEffect(() => {
    if (payload && roomParam && connectionState === 'disconnected') {
      joinViewerHandshake(roomParam);
    }
  }, [payload, roomParam]);

  const handleDecrypt = async () => {
    const rawToken = tokenInput.trim();
    const cleanPass = passphrase.trim();
    if (!rawToken || !cleanPass) return;

    const token = extractTokenFromURL(rawToken) || rawToken;

    setDecrypting(true);
    setErrorMsg(null);
    try {
      let activePayload = await decodeToken(token, cleanPass);

      // Try fetching latest state from Render RAM cache first
      if (roomParam) {
        try {
          const stateRes = await fetch(API.signal.state(roomParam));
          if (stateRes.status === 200) {
            const resData = await stateRes.json();
            if (resData.state) {
              const decryptedStr = await decrypt(resData.state, cleanPass);
              activePayload = JSON.parse(decryptedStr);
              console.log('[Sekundo] Loaded latest state from Render volatile state.');
            }
          }
        } catch (e) {
          console.warn('[Sekundo] Fallback to direct token payload:', e);
        }
      }

      setPayload(activePayload);
    } catch (err: any) {
      setErrorMsg('Decryption Failed. Please verify the passphrase.');
    } finally {
      setDecrypting(false);
    }
  };

  const handleEscalate = async () => {
    const cleanPass = escalatePass.trim();
    if (!cleanPass || !payload) return;

    setEscalateError(null);
    try {
      // Validate passphrase matches by attempting to re-decode the initial token
      const rawToken = tokenInput.trim();
      const token = extractTokenFromURL(rawToken) || rawToken;
      await decodeToken(token, cleanPass);

      setIsAdminMode(true);
      setShowEscalateModal(false);
      setEscalatePass('');
    } catch (err) {
      setEscalateError('Invalid Passphrase. Action unauthorized.');
    }
  };

  // Auto-Save modifications to Render RAM cache
  const triggerAutoSave = async (updatedSkeleton: FlatSkeletonEntry[]) => {
    if (!roomParam || !payload) return;

    try {
      const updatedPayload: HorizonPayload = { ...payload, skeleton: updatedSkeleton };
      const rawPayload = JSON.stringify(updatedPayload);
      const encryptedData = await encrypt(rawPayload, passphrase);

      await fetch(API.signal.state(roomParam), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ state: encryptedData }),
      });
      console.log('[Sekundo] State auto-saved to Render cache.');
    } catch (err) {
      console.error('[Sekundo] Auto-save failed:', err);
    }
  };

  // Node editing handlers
  const openAddChildModal = (parentKey: string) => {
    setParentNodeKey(parentKey);
    setEditingNode(null);
    const children = payload?.skeleton.filter(
      (item) => item.key.startsWith(parentKey + '-') && item.key.split('-').length === parentKey.split('-').length + 1
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
    setParentNodeKey(null);
    setEditingNode(node);
    setNodeKey(node.key);
    setNodeLabel(node.label);
    setNodeType(node.type);
    setNodeEmail(node.email || '');
    setEditModalVisible(true);
  };

  const handleSaveNode = () => {
    if (!payload) return;
    let newSkeleton = [...payload.skeleton];

    if (editingNode) {
      // Modify
      newSkeleton = newSkeleton.map((item) =>
        item.key === editingNode.key
          ? { ...item, label: nodeLabel, type: nodeType, email: nodeEmail }
          : item
      );
    } else {
      // Insert
      newSkeleton.push({
        key: nodeKey,
        label: nodeLabel,
        type: nodeType,
        email: nodeEmail,
        value: '',
        meta: {},
      });
    }

    setPayload({ ...payload, skeleton: newSkeleton });
    setEditModalVisible(false);

    // Live WebRTC broadcast & Server background auto-save
    broadcastState(newSkeleton);
    triggerAutoSave(newSkeleton);
  };

  const deleteNode = (key: string) => {
    if (!payload) return;
    // Recursive descendant delete
    const newSkeleton = payload.skeleton.filter(
      (item) => item.key !== key && !item.key.startsWith(key + '-')
    );

    setPayload({ ...payload, skeleton: newSkeleton });

    // Live WebRTC broadcast & Server background auto-save
    broadcastState(newSkeleton);
    triggerAutoSave(newSkeleton);
  };

  const handleReset = () => {
    closeConnection();
    setPayload(null);
    setPassphrase('');
    setIsAdminMode(false);
    setErrorMsg(null);
  };

  const tree = payload ? skeletonTree.buildTree(payload.skeleton) : [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.card, payload && styles.largeCard]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Sekundo Viewer</Text>
          <Text style={styles.subtitle}>
            {payload
              ? `Decrypted session ${isAdminMode ? '• ADMIN MODE' : ''}`
              : 'Decrypt Secure Share Link'}
          </Text>
        </View>

        {!payload ? (
          <View style={styles.form}>
            {/* Token Input */}
            <Text style={styles.label}>PASTE SHARABLE LINK OR SECURE TOKEN</Text>
            <TextInput
              style={styles.input}
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="https://sekundo.app/#/view?data=aBcDe..."
              placeholderTextColor="#4F5E74"
            />

            {/* Passphrase Input */}
            <Text style={[styles.label, { marginTop: 20 }]}>DECRYPTION PASSPHRASE</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="Enter out-of-band secret key"
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
                <Text style={styles.primaryBtnText}>Decrypt Payload</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.viewerWorkspace}>
            {/* Meta bar */}
            <View style={styles.metaBar}>
              <View>
                <Text style={styles.metaTitle}>{payload.eventName}</Text>
                <Text style={styles.metaSub}>
                  Recurrence: {payload.eventFrequency.toUpperCase()} • Live Peer Sync:{' '}
                  {connectionState.toUpperCase()}
                </Text>
              </View>

              <View style={{ flexDirection: 'row' }}>
                {!isAdminMode ? (
                  <Pressable
                    onPress={() => setShowEscalateModal(true)}
                    style={[styles.exitBtn, { marginRight: 8, borderColor: '#FFB800' }]}
                  >
                    <Text style={[styles.exitBtnText, { color: '#FFB800' }]}>Enable Admin Mode</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={openAddRootModal}
                    style={[styles.exitBtn, { marginRight: 8, borderColor: '#8B5CF6' }]}
                  >
                    <Text style={[styles.exitBtnText, { color: '#8B5CF6' }]}>+ Add Root</Text>
                  </Pressable>
                )}
                <Pressable onPress={handleReset} style={styles.exitBtn}>
                  <Text style={styles.exitBtnText}>Lock Session</Text>
                </Pressable>
              </View>
            </View>

            {/* TreeView (Read-Write callbacks are active if escalated to admin mode) */}
            <ScrollView style={styles.treeScroll}>
              <View style={styles.treeWrapper}>
                <TreeView
                  nodes={tree}
                  onAddChild={isAdminMode ? openAddChildModal : undefined}
                  onEditNode={isAdminMode ? openEditModal : undefined}
                  onDeleteNode={isAdminMode ? deleteNode : undefined}
                />
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Escalation Modal */}
      <Modal animationType="fade" transparent visible={showEscalateModal} onRequestClose={() => setShowEscalateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Administrative Escalation</Text>
            <Text style={styles.modalHelp}>
              Provide the master symmetric Passphrase to unlock Read-Write node editing controls.
            </Text>
            
            <TextInput
              style={styles.input}
              secureTextEntry
              value={escalatePass}
              onChangeText={setEscalatePass}
              placeholder="Enter master passphrase"
              placeholderTextColor="#4F5E74"
            />

            {escalateError ? <Text style={styles.errorText}>{escalateError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable onPress={handleEscalate} style={styles.modalPrimaryBtn}>
                <Text style={styles.modalPrimaryBtnText}>Unlock Admin</Text>
              </Pressable>
              <Pressable onPress={() => setShowEscalateModal(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit/Add Node Modal */}
      <Modal animationType="fade" transparent visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingNode ? 'Edit Node' : 'Add Node'}</Text>
            
            <Text style={styles.modalLabel}>PATH KEY ADDRESS</Text>
            <TextInput
              style={[styles.input, editingNode && styles.inputReadOnly]}
              value={nodeKey}
              onChangeText={setNodeKey}
              editable={!editingNode}
              placeholder="e.g. 01-01"
              placeholderTextColor="#4F5E74"
            />

            <Text style={[styles.modalLabel, { marginTop: 14 }]}>LABEL NAME</Text>
            <TextInput
              style={styles.input}
              value={nodeLabel}
              onChangeText={setNodeLabel}
              placeholder="e.g. Lead Coordinator"
              placeholderTextColor="#4F5E74"
            />

            <Text style={[styles.modalLabel, { marginTop: 14 }]}>NODE TYPE</Text>
            <View style={styles.typeRow}>
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

            {nodeType === 'slot' ? (
              <>
                <Text style={[styles.modalLabel, { marginTop: 14 }]}>EMAIL ASSIGNEE (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={nodeEmail}
                  onChangeText={setNodeEmail}
                  placeholder="assignee@domain.com"
                  placeholderTextColor="#4F5E74"
                />
              </>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable onPress={handleSaveNode} style={styles.modalPrimaryBtn}>
                <Text style={styles.modalPrimaryBtnText}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setEditModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    display: 'flex',
    flexDirection: 'column',
  },
  largeCard: {
    maxWidth: 900,
    height: '100%',
    maxHeight: 700,
  },
  header: {
    marginBottom: 24,
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#FFB800',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#8A94A6',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    color: '#FFFFFF',
    padding: 14,
    fontSize: 14,
    width: '100%',
  },
  inputReadOnly: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#8A94A6',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  primaryBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  btnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  primaryBtnText: {
    color: '#12151C',
    fontWeight: '700',
    fontSize: 16,
  },
  viewerWorkspace: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  metaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 16,
    marginBottom: 16,
  },
  metaTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  metaSub: {
    color: '#8A94A6',
    fontSize: 12,
    marginTop: 4,
  },
  exitBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  exitBtnText: {
    color: '#A9B4C5',
    fontSize: 12,
    fontWeight: '600',
  },
  treeScroll: {
    flex: 1,
  },
  treeWrapper: {
    paddingVertical: 8,
  },
  // Modal layout
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 12, 17, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#161922',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalHelp: {
    color: '#8A94A6',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalLabel: {
    color: '#6F7E94',
    fontSize: 10,
    fontWeight: '700',
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
    fontWeight: '700',
    fontSize: 13,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalCancelBtnText: {
    color: '#A9B4C5',
    fontWeight: '600',
    fontSize: 13,
  },
  typeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  typeBtnActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: '#8B5CF6',
  },
  typeBtnText: {
    color: '#A9B4C5',
    fontSize: 12,
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: '#8B5CF6',
    fontWeight: '700',
  },
});
