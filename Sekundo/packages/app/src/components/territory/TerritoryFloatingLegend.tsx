import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import {
  SYMBOLOGY_DIMENSION_OPTIONS,
  type SymbologyDimension,
  type SymbologyLegendItem,
} from './mapSymbologyEngine';

export interface TerritoryFloatingLegendProps {
  dimension: SymbologyDimension;
  items: SymbologyLegendItem[];
  onResetToUnified: () => void;
}

/**
 * `<TerritoryFloatingLegend />`
 *
 * Legenda cartográfica flutuante sob demanda:
 * - Quando `dimension === 'none'` (padrão universal de ícone único), retorna `null`
 *   para manter o canvas 100% livre de poluição visual.
 * - Quando o usuário escolhe agrupar ícones por Território, Zona, Bairro, Cidade,
 *   UF/País, Tipo de Imóvel ou Profundidade da Chave (`path_depth_1..3`), exibe
 *   um painel flutuante compacto e recolhível no canto inferior esquerdo do mapa.
 */
export function TerritoryFloatingLegend({
  dimension,
  items,
  onResetToUnified,
}: TerritoryFloatingLegendProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (dimension === 'none' || items.length === 0) {
    return null;
  }

  const dimMeta = SYMBOLOGY_DIMENSION_OPTIONS.find((d) => d.id === dimension);
  const title = dimMeta ? dimMeta.shortLabel.toUpperCase() : dimension.toUpperCase();

  return (
    <View style={styles.floatingContainer} testID="territory-floating-legend">
      <View style={styles.headerRow}>
        <Pressable
          testID="territory-floating-legend-toggle"
          onPress={() => setCollapsed((c) => !c)}
          style={styles.headerToggle}
        >
          <Text style={styles.headerTitle}>
            🎨 LEGENDA: {title} ({items.length})
          </Text>
          <Text style={styles.chevron}>{collapsed ? '▲' : '▼'}</Text>
        </Pressable>

        <Pressable
          testID="territory-floating-legend-reset"
          onPress={onResetToUnified}
          style={styles.resetPill}
        >
          <Text style={styles.resetPillText}>Ícone Único ✕</Text>
        </Pressable>
      </View>

      {!collapsed ? (
        <ScrollView
          style={styles.itemsScroll}
          contentContainerStyle={styles.itemsWrap}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => (
            <View key={item.categoryKey} style={styles.legendChip}>
              <View style={[styles.swatchBadge, { backgroundColor: item.color }]}>
                <Text style={styles.swatchGlyph}>{item.shapeGlyph}</Text>
              </View>
              <Text style={styles.legendLabel} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={styles.legendCount}>({item.count})</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    maxWidth: 310,
    backgroundColor: 'rgba(11, 16, 29, 0.92)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    zIndex: 1100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chevron: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  resetPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  resetPillText: {
    color: '#FCA5A5',
    fontSize: 9,
    fontWeight: '800',
  },
  itemsScroll: {
    maxHeight: 130,
    marginTop: 8,
  },
  itemsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  swatchBadge: {
    width: 15,
    height: 15,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchGlyph: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  legendLabel: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 110,
  },
  legendCount: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
  },
});
