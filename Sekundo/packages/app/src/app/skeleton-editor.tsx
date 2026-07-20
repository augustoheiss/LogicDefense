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
import { serializeCSV } from '@sekundo/core';
import type { NodeType, SkeletonNode } from '@sekundo/core';

export default function SkeletonEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events } = useLocalEvent();
  const event = events.find((e) => e.config.id === eventId);

  const { flatRegistry, tree, loading, addNode, updateNode, deleteNode } = useSkeleton(eventId);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
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
          <Pressable onPress={handleExportCSV} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Export CSV</Text>
          </Pressable>
        </View>
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
              onAddChild={openAddChildModal}
              onEditNode={openEditModal}
              onDeleteNode={deleteNode}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
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
