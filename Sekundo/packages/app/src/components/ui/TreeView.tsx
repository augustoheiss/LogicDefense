/**
 * Component: TreeView (Recursive Node Renderer)
 *
 * Renders an infinite-depth skeleton structure from path keys.
 * Calculates indentation proportionally based on key depth.
 * Supports folding, child node creation, editing, and deletion.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import type { SkeletonNode } from '@sekundo/core';

interface TreeViewProps {
  nodes: SkeletonNode[];
  onAddChild?: (parentKey: string) => void;
  onEditNode?: (node: SkeletonNode) => void;
  onDeleteNode?: (key: string) => void;
}

export function TreeView({ nodes, onAddChild, onEditNode, onDeleteNode }: TreeViewProps) {
  return (
    <View style={styles.treeContainer}>
      {nodes.map((node) => (
        <TreeNode
          key={node.key}
          node={node}
          onAddChild={onAddChild}
          onEditNode={onEditNode}
          onDeleteNode={onDeleteNode}
        />
      ))}
    </View>
  );
}

function TreeNode({
  node,
  onAddChild,
  onEditNode,
  onDeleteNode,
}: {
  node: SkeletonNode;
  onAddChild?: (parentKey: string) => void;
  onEditNode?: (node: SkeletonNode) => void;
  onDeleteNode?: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const segments = node.key.split('-');
  const depth = segments.length;
  const indentation = (depth - 1) * 20; // 20px padding per nesting level
  const hasChildren = node.children.length > 0;

  return (
    <View style={styles.nodeWrapper}>
      {/* Node Card Row */}
      <View style={[styles.nodeRow, { paddingLeft: indentation + 12 }]}>
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
        </View>

        {/* Action Buttons */}
        <View style={styles.controls}>
          {onAddChild ? (
            <Pressable onPress={() => onAddChild(node.key)} style={styles.controlBtn}>
              <Text style={styles.controlBtnText}>+ Child</Text>
            </Pressable>
          ) : null}
          {onEditNode ? (
            <Pressable onPress={() => onEditNode(node)} style={styles.controlBtn}>
              <Text style={styles.controlBtnText}>Edit</Text>
            </Pressable>
          ) : null}
          {onDeleteNode ? (
            <Pressable
              onPress={() => onDeleteNode(node.key)}
              style={[styles.controlBtn, styles.deleteBtn]}
            >
              <Text style={[styles.controlBtnText, styles.deleteBtnText]}>Delete</Text>
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
              onAddChild={onAddChild}
              onEditNode={onEditNode}
              onDeleteNode={onDeleteNode}
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
    marginRight: 12,
  },
  expandToggle: {
    padding: 6,
    marginRight: 4,
  },
  expandToggleText: {
    color: '#8A94A6',
    fontSize: 10,
  },
  expandSpacer: {
    width: 22,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 10,
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
    marginLeft: 12,
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
  },
  controlBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginLeft: 6,
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
  childrenContainer: {
    width: '100%',
  },
});
