/**
 * Component: CSVPreviewTable
 *
 * Renders a high-fidelity visual comparison table between current event configuration
 * and imported CSV rows. Highlights additions (green), modifications (yellow/orange),
 * and deletions (red).
 */

import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import type { CSVDiffResult } from '@sekundo/core';

interface CSVPreviewTableProps {
  diff: CSVDiffResult;
}

export function CSVPreviewTable({ diff }: CSVPreviewTableProps) {
  return (
    <View style={styles.container}>
      {/* Stats Summary Bar */}
      <View style={styles.statsBar}>
        <View style={[styles.statItem, styles.statAdd]}>
          <Text style={styles.statVal}>{diff.added}</Text>
          <Text style={styles.statLabel}>Added</Text>
        </View>
        <View style={[styles.statItem, styles.statMod]}>
          <Text style={styles.statVal}>{diff.modified}</Text>
          <Text style={styles.statLabel}>Modified</Text>
        </View>
        <View style={[styles.statItem, styles.statDel]}>
          <Text style={styles.statVal}>{diff.deleted}</Text>
          <Text style={styles.statLabel}>Deleted</Text>
        </View>
        <View style={[styles.statItem, styles.statUnchanged]}>
          <Text style={styles.statVal}>{diff.unchanged}</Text>
          <Text style={styles.statLabel}>Unchanged</Text>
        </View>
      </View>

      {/* Diff Table List */}
      <ScrollView style={styles.tableScroll}>
        {diff.entries.map((entry) => {
          let rowStyle = styles.rowUnchanged;
          let badgeText = 'UNCHANGED';
          let badgeStyle = styles.badgeUnchanged;

          if (entry.action === 'add') {
            rowStyle = styles.rowAdd;
            badgeText = 'ADDED';
            badgeStyle = styles.badgeAdd;
          } else if (entry.action === 'modify') {
            rowStyle = styles.rowMod;
            badgeText = 'MODIFIED';
            badgeStyle = styles.badgeMod;
          } else if (entry.action === 'delete') {
            rowStyle = styles.rowDel;
            badgeText = 'DELETED';
            badgeStyle = styles.badgeDel;
          }

          return (
            <View key={entry.key} style={[styles.diffRow, rowStyle]}>
              {/* Header Info */}
              <View style={styles.rowHeader}>
                <Text style={styles.keyText}>{entry.key}</Text>
                <View style={[styles.badge, badgeStyle]}>
                  <Text style={styles.badgeText}>{badgeText}</Text>
                </View>
              </View>

              {/* Data comparison view */}
              <View style={styles.rowBody}>
                {/* Left Side: Current State */}
                {entry.action !== 'add' && (
                  <View style={styles.sideCard}>
                    <Text style={styles.sideTitle}>Current</Text>
                    <Text style={styles.sideText} numberOfLines={1}>
                      Label: {entry.currentLabel}
                    </Text>
                    {entry.currentValue !== undefined ? (
                      <Text style={styles.sideTextVal} numberOfLines={1}>
                        Value: {entry.currentValue || '(empty)'}
                      </Text>
                    ) : null}
                  </View>
                )}

                {/* Arrow indicator for modification */}
                {entry.action === 'modify' && (
                  <View style={styles.arrowContainer}>
                    <Text style={styles.arrowText}>➔</Text>
                  </View>
                )}

                {/* Right Side: Incoming State */}
                {entry.action !== 'delete' && (
                  <View style={styles.sideCard}>
                    <Text style={styles.sideTitle}>Incoming</Text>
                    <Text style={styles.sideText} numberOfLines={1}>
                      Label: {entry.incomingLabel}
                    </Text>
                    {entry.incomingValue !== undefined ? (
                      <Text style={styles.sideTextVal} numberOfLines={1}>
                        Value: {entry.incomingValue || '(empty)'}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    color: '#8A94A6',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statAdd: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
  },
  statMod: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
  },
  statDel: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
  },
  statUnchanged: {},
  tableScroll: {
    flex: 1,
  },
  diffRow: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  keyText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  rowAdd: {
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  rowMod: {
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  rowDel: {
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  rowUnchanged: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  badgeAdd: {
    backgroundColor: '#10B981',
  },
  badgeMod: {
    backgroundColor: '#F59E0B',
  },
  badgeDel: {
    backgroundColor: '#EF4444',
  },
  badgeUnchanged: {
    backgroundColor: '#6B7280',
  },
  rowBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sideCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    padding: 10,
  },
  sideTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6F7E94',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  sideText: {
    color: '#D1D5DB',
    fontSize: 13,
  },
  sideTextVal: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  arrowContainer: {
    paddingHorizontal: 12,
  },
  arrowText: {
    color: '#F59E0B',
    fontSize: 18,
  },
});
