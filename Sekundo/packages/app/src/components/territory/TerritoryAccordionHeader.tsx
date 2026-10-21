/**
 * Component: TerritoryAccordionHeader
 *
 * Collapsible section header used by the field checklist to group units by territory.
 * Shows territory id, group count, recency badge, quick batch/publisher actions,
 * and a compact progress bar so a collapsed list answers "how much is left?" at a glance.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  territory: string;
  groupCount: number;
  worked: number;
  total: number;
  expanded: boolean;
  daysSinceCompleted?: number | null;
  mapOpen?: boolean;
  onToggle: () => void;
  onBatchToggle?: () => void;
  onOpenPublisher?: () => void;
  onToggleMap?: () => void;
  onOpenGoogleMaps?: () => void;
}

export function TerritoryAccordionHeader({
  territory,
  groupCount,
  worked,
  total,
  expanded,
  daysSinceCompleted,
  mapOpen,
  onToggle,
  onBatchToggle,
  onOpenPublisher,
  onToggleMap,
  onOpenGoogleMaps,
}: Props) {
  const percent = total > 0 ? Math.round((worked / total) * 100) : 0;
  const done = total > 0 && worked === total;

  return (
    <View style={[styles.header, expanded && styles.headerExpanded]}>
      <Pressable
        onPress={onToggle}
        style={styles.mainClickArea}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Território ${territory}, ${worked} de ${total} concluídas`}
      >
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text style={styles.badge}>{territory}</Text>
            <Text style={styles.meta}>
              {groupCount} {groupCount === 1 ? 'quadra' : 'quadras'} • {worked}/{total} ({percent}%)
            </Text>
            {done ? (
              <Text style={styles.doneTag}>
                ✓ completo
                {typeof daysSinceCompleted === 'number'
                  ? daysSinceCompleted === 0
                    ? ' (hoje)'
                    : ` (há ${daysSinceCompleted}d)`
                  : ''}
              </Text>
            ) : null}
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, done && styles.fillDone, { width: `${percent}%` }]} />
          </View>
        </View>
      </Pressable>

      <View style={styles.actions}>
        {onToggleMap ? (
          <Pressable
            testID={`checklist-territory-map-btn-${territory}`}
            onPress={onToggleMap}
            style={[
              styles.pubBtn,
              mapOpen && {
                backgroundColor: 'rgba(56, 189, 248, 0.28)',
                borderColor: '#38BDF8',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Ver mapa do território ${territory}`}
          >
            <Text style={[styles.pubBtnText, mapOpen && { color: '#38BDF8', fontWeight: '900' }]}>
              {mapOpen ? '🗺️ Ocultar Mapa' : '🗺️ Mapa'}
            </Text>
          </Pressable>
        ) : null}
        {onOpenGoogleMaps ? (
          <Pressable
            testID={`checklist-territory-gmaps-btn-${territory}`}
            onPress={onOpenGoogleMaps}
            style={styles.pubBtn}
            accessibilityRole="button"
            accessibilityLabel={`Abrir território ${territory} no Google Maps`}
          >
            <Text style={styles.pubBtnText}>🗺️ Google Maps</Text>
          </Pressable>
        ) : null}
        {onOpenPublisher ? (
          <Pressable
            testID={`checklist-territory-campo-btn-${territory}`}
            onPress={onOpenPublisher}
            style={styles.pubBtn}
            accessibilityRole="button"
            accessibilityLabel={`Modo Operador de Campo para ${territory}`}
          >
            <Text style={styles.pubBtnText}>📱 Campo</Text>
          </Pressable>
        ) : null}
        {onBatchToggle ? (
          <Pressable
            onPress={onBatchToggle}
            style={[styles.batchBtn, done && styles.batchBtnReset]}
            accessibilityRole="button"
            accessibilityLabel={done ? `Reabrir território ${territory}` : `Concluir território ${territory}`}
          >
            <Text style={[styles.batchBtnText, done && styles.batchBtnTextReset]}>
              {done ? '↺ Reabrir' : '✓ Concluir'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.18)',
  },
  headerExpanded: {
    borderColor: 'rgba(255, 184, 0, 0.45)',
    backgroundColor: '#1C2230',
  },
  mainClickArea: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chevron: {
    color: '#FFB800',
    fontSize: 18,
    width: 16,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    color: '#FFB800',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  meta: {
    color: '#A7B0C0',
    fontSize: 12,
    fontWeight: '600',
  },
  doneTag: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#FFB800',
  },
  fillDone: {
    backgroundColor: '#10B981',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pubBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  pubBtnText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  batchBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  batchBtnReset: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  batchBtnText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
  },
  batchBtnTextReset: {
    color: '#CBD5E1',
  },
});
