/**
 * Component: TreeView (Recursive Node Renderer)
 *
 * Renders an infinite-depth skeleton structure from path keys.
 * Calculates indentation proportionally based on key depth.
 * Supports folding, child node creation, editing, and deletion.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import type { SkeletonNode, EngineId } from '@sekundo/core';

interface TreeViewProps {
  nodes: SkeletonNode[];
  engineId?: EngineId;
  onAddChild?: (parentKey: string) => void;
  onEditNode?: (node: SkeletonNode) => void;
  onDeleteNode?: (key: string) => void;
  onToggleWork?: (nodeKey: string, newStatus: 0 | 1) => void;
}

export function TreeView({
  nodes,
  engineId,
  onAddChild,
  onEditNode,
  onDeleteNode,
  onToggleWork,
}: TreeViewProps) {
  return (
    <View style={styles.treeContainer}>
      {nodes.map((node) => (
        <TreeNode
          key={node.key}
          node={node}
          engineId={engineId}
          onAddChild={onAddChild}
          onEditNode={onEditNode}
          onDeleteNode={onDeleteNode}
          onToggleWork={onToggleWork}
        />
      ))}
    </View>
  );
}

function TreeNode({
  node,
  engineId,
  onAddChild,
  onEditNode,
  onDeleteNode,
  onToggleWork,
}: {
  node: SkeletonNode;
  engineId?: EngineId;
  onAddChild?: (parentKey: string) => void;
  onEditNode?: (node: SkeletonNode) => void;
  onDeleteNode?: (key: string) => void;
  onToggleWork?: (nodeKey: string, newStatus: 0 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const segments = node.key.split(/[.-]/);
  const depth = segments.length;
  const indentation = Math.min((depth - 1) * 14, 48); // Cap indentation so deep mobile trees stay readable
  const hasChildren = node.children.length > 0;

  return (
    <View style={styles.nodeWrapper}>
      {/* Node Card Row */}
      <View style={[styles.nodeRow, { paddingLeft: indentation + 10 }]}>
        <View style={styles.nodeContent}>
          {/* Fold Toggle Indicator */}
          {hasChildren ? (
            <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandToggle}>
              <Text style={styles.expandToggleText}>{expanded ? '▼' : '▶'}</Text>
            </Pressable>
          ) : (
            <View style={styles.expandSpacer} />
          )}

          {/* Type Badge */}
          <View
            style={[
              styles.typeBadge,
              node.type === 'header' && styles.badgeHeader,
              node.type === 'slot' && styles.badgeSlot,
              node.type === 'territory' && styles.badgeTerritory,
              node.type === 'note' && styles.badgeNote,
            ]}
          >
            <Text style={styles.typeBadgeText}>{node.type.substring(0, 4).toUpperCase()}</Text>
          </View>

          {/* Label + Path Key */}
          <View style={styles.textContainer}>
            <Text style={styles.nodeLabel}>{node.label}</Text>
            <Text style={styles.nodeKey}>{node.key}</Text>
          </View>

          {/* Assigned Value / Data */}
          {node.value ? (
            <View style={styles.valueCard}>
              <Text style={styles.valueText} numberOfLines={1}>
                {node.value}
              </Text>
            </View>
          ) : null}

          {/* Domain Badges according to Engine */}
          {engineId === 'study_synthesis' && (node.meta?.synthesisText as string) ? (
            <View style={styles.synthesisBadge}>
              <Text style={styles.synthesisBadgeText}>📝 Síntese</Text>
            </View>
          ) : null}

          {engineId === 'roster_assignments' && node.meta?.confirmed ? (
            <View style={styles.confirmedBadge}>
              <Text style={styles.confirmedBadgeText}>👍 Confirmado</Text>
            </View>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.controls}>
          {/* 0/1 Quick-Toggle for Territory Engine */}
          {engineId === 'territory_logistics' && onToggleWork ? (
            <Pressable
              onPress={() => onToggleWork(node.key, node.meta?.worked === 1 ? 0 : 1)}
              style={[
                styles.workToggleBtn,
                node.meta?.worked === 1 ? styles.workToggleDone : styles.workTogglePending,
              ]}
            >
              <Text
                style={[
                  styles.workToggleText,
                  node.meta?.worked === 1 ? styles.workToggleTextDone : styles.workToggleTextPending,
                ]}
              >
                {node.meta?.worked === 1 ? '1 ✅' : '0 ⬜'}
              </Text>
            </Pressable>
          ) : null}

          {onAddChild ? (
            <Pressable onPress={() => onAddChild(node.key)} style={styles.controlBtn}>
              <Text style={styles.controlBtnText}>+ Filho</Text>
            </Pressable>
          ) : null}
          {onEditNode ? (
            <Pressable onPress={() => onEditNode(node)} style={styles.controlBtn}>
              <Text style={styles.controlBtnText}>Editar</Text>
            </Pressable>
          ) : null}
          {onDeleteNode ? (
            <Pressable
              onPress={() => onDeleteNode(node.key)}
              style={[styles.controlBtn, styles.deleteBtn]}
            >
              <Text style={[styles.controlBtnText, styles.deleteBtnText]}>Excluir</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Recursive Children Rendering */}
      {expanded && hasChildren ? (
        <View style={styles.childrenContainer}>
          {node.children.map((child) => (
            <TreeNode
              key={child.key}
              node={child}
              engineId={engineId}
              onAddChild={onAddChild}
              onEditNode={onEditNode}
              onDeleteNode={onDeleteNode}
              onToggleWork={onToggleWork}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  treeContainer: {
    width: '100%',
  },
  nodeWrapper: {
    width: '100%',
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingRight: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  nodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 180,
    flexWrap: 'wrap',
    gap: 6,
  },
  expandToggle: {
    padding: 6,
  },
  expandToggleText: {
    color: '#8A94A6',
    fontSize: 10,
  },
  expandSpacer: {
    width: 18,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  badgeHeader: {
    backgroundColor: '#3B82F6', // Blue
  },
  badgeSlot: {
    backgroundColor: '#10B981', // Green
  },
  badgeTerritory: {
    backgroundColor: '#8B5CF6', // Purple
  },
  badgeNote: {
    backgroundColor: '#6B7280', // Gray
  },
  textContainer: {
    flex: 1,
    minWidth: 120,
    justifyContent: 'center',
  },
  nodeLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  nodeKey: {
    color: '#4F5E74',
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  valueCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 150,
  },
  valueText: {
    color: '#FFB800', // Gold
    fontSize: 12,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  controlBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  controlBtnText: {
    color: '#A9B4C5',
    fontSize: 11,
    fontWeight: '500',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteBtnText: {
    color: '#EF4444',
  },
  synthesisBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  synthesisBadgeText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '600',
  },
  confirmedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  confirmedBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '600',
  },
  workToggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 6,
  },
  workToggleDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  workTogglePending: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  workToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  workToggleTextDone: {
    color: '#34D399',
  },
  workToggleTextPending: {
    color: '#8A94A6',
  },
  childrenContainer: {
    width: '100%',
  },
});
