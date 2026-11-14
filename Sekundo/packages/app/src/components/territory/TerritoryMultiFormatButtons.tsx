/**
 * Component: TerritoryMultiFormatButtons
 *
 * Reusable compact CAD action strip exposing Sekundo's multi-format exports & import
 * (.XLSX, .KML Numerado, .KML Completo, .GeoJSON, .ZIP GIS Individual, .JSON, .CSV)
 * consistently across workspace pages and CAD popovers.
 */

import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FlatSkeletonEntry } from '@sekundo/core';
import {
  deliverTerritoryMultiFormatPreset,
  type TerritoryExportPresetId,
} from '../../utils/territoryExportDelivery';

interface PresetButtonSpec {
  id: TerritoryExportPresetId;
  shortLabel: string;
  fullLabel: string;
  hint: string;
  accentColor: string;
  bgColor: string;
}

export const TERRITORY_MULTI_EXPORT_PRESETS: Record<TerritoryExportPresetId, PresetButtonSpec> = {
  zip_gis: {
    id: 'zip_gis',
    shortLabel: '🧩 .ZIP GIS',
    fullLabel: '🧩 Pacote GIS (.ZIP Individual + Consolidado)',
    hint: 'Baixa .ZIP com polígonos numerados (1 arquivo .kml/.geojson por território + consolidado, seguro sem sobrescrever)',
    accentColor: '#34D399',
    bgColor: 'rgba(16, 185, 129, 0.18)',
  },
  kml_numbered: {
    id: 'kml_numbered',
    shortLabel: '🏷️ .KML Nº',
    fullLabel: '🏷️ .KML Polígonos Numerados',
    hint: 'Baixa .KML consolidado somente com polígonos identificados pelo número oficial (T01.01.01)',
    accentColor: '#38BDF8',
    bgColor: 'rgba(56, 189, 248, 0.16)',
  },
  kml_full: {
    id: 'kml_full',
    shortLabel: '🗺️ .KML',
    fullLabel: '🗺️ .KML Quadras/Bairros',
    hint: 'Baixa .KML organizado por bairros (Folder) e quadras',
    accentColor: '#60A5FA',
    bgColor: 'rgba(59, 130, 246, 0.16)',
  },
  geojson_gis: {
    id: 'geojson_gis',
    shortLabel: '🌍 .GeoJSON GIS',
    fullLabel: '🌍 .GeoJSON Polígonos Numerados',
    hint: 'Baixa .GeoJSON consolidado (Polygon, TerritoryNumber, [lng, lat])',
    accentColor: '#A78BFA',
    bgColor: 'rgba(139, 92, 246, 0.16)',
  },
  geojson: {
    id: 'geojson',
    shortLabel: '🌐 .GeoJSON',
    fullLabel: '🌐 .GeoJSON Padrão',
    hint: 'Baixa .GeoJSON completo com quadras e pontos',
    accentColor: '#C084FC',
    bgColor: 'rgba(192, 132, 252, 0.16)',
  },
  xlsx_18col: {
    id: 'xlsx_18col',
    shortLabel: '📊 .XLSX',
    fullLabel: '📊 Planilha .XLSX (18 Colunas)',
    hint: 'Baixa planilha Excel (.xlsx) compatível com sistemas de endereços externos',
    accentColor: '#FBBF24',
    bgColor: 'rgba(245, 158, 11, 0.16)',
  },
  csv_18col: {
    id: 'csv_18col',
    shortLabel: '📄 .CSV 18c',
    fullLabel: '📄 .CSV Externo (18 Colunas)',
    hint: 'Baixa CSV no layout padrão de 18 colunas',
    accentColor: '#CBD5E1',
    bgColor: 'rgba(148, 163, 184, 0.14)',
  },
  csv_19col: {
    id: 'csv_19col',
    shortLabel: '📄 .CSV 19c',
    fullLabel: '📄 .CSV Modelo Sekundo (19 Colunas)',
    hint: 'Baixa CSV no modelo editável completo do Sekundo (19 colunas)',
    accentColor: '#94A3B8',
    bgColor: 'rgba(148, 163, 184, 0.14)',
  },
  json: {
    id: 'json',
    shortLabel: '📦 .JSON',
    fullLabel: '📦 Backup .JSON',
    hint: 'Baixa backup estruturado em JSON',
    accentColor: '#F472B6',
    bgColor: 'rgba(244, 114, 182, 0.15)',
  },
};

export interface TerritoryMultiFormatButtonsProps {
  nodes?: FlatSkeletonEntry[];
  presets?: TerritoryExportPresetId[];
  compact?: boolean;
  privacySafeMode?: boolean;
  includeKmlPoints?: boolean;
  showImportButton?: boolean;
  importLabel?: string;
  onPressImport?: () => void;
  onFeedback?: (msg: string) => void;
  onAfterAction?: () => void;
  testIdPrefix?: string;
}

const DEFAULT_PRESETS: TerritoryExportPresetId[] = [
  'zip_gis',
  'kml_numbered',
  'xlsx_18col',
  'kml_full',
  'geojson_gis',
  'json',
  'csv_18col',
  'csv_19col',
];

export function TerritoryMultiFormatButtons({
  nodes,
  presets = DEFAULT_PRESETS,
  compact = true,
  privacySafeMode = true,
  includeKmlPoints = false,
  showImportButton = false,
  importLabel = '📥 Importar (.XLSX/.KML/.GeoJSON/.CSV)',
  onPressImport,
  onFeedback,
  onAfterAction,
  testIdPrefix = 'multi-fmt',
}: TerritoryMultiFormatButtonsProps) {
  const [busyPreset, setBusyPreset] = useState<string | null>(null);
  const webTitle = (title: string) => (Platform.OS === 'web' ? ({ title } as any) : {});

  const handleExport = async (preset: TerritoryExportPresetId) => {
    setBusyPreset(preset);
    try {
      const result = await deliverTerritoryMultiFormatPreset(nodes, preset, {
        privacySafeMode,
        includeKmlPoints,
      });
      onFeedback?.(result.message);
      if (result.delivered) {
        onAfterAction?.();
      }
    } catch (err: any) {
      onFeedback?.(`⚠️ Erro ao exportar: ${err?.message || 'Falha desconhecida'}`);
    } finally {
      setBusyPreset(null);
    }
  };

  return (
    <View style={styles.rowWrap}>
      {showImportButton && onPressImport ? (
        <Pressable
          testID={`${testIdPrefix}-import-btn`}
          accessibilityRole="button"
          accessibilityLabel={importLabel}
          {...webTitle('Importar arquivos .CSV, .XLSX, .KML, .GeoJSON ou .JSON')}
          onPress={() => {
            onPressImport();
            onAfterAction?.();
          }}
          style={[
            compact ? styles.chipBtnCompact : styles.chipBtnFull,
            {
              borderColor: '#3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.18)',
            },
          ]}
        >
          <Text style={[styles.chipText, { color: '#60A5FA' }]}>
            {compact ? '📥 Importar Multi' : importLabel}
          </Text>
        </Pressable>
      ) : null}

      {presets.map((presetId) => {
        const spec = TERRITORY_MULTI_EXPORT_PRESETS[presetId];
        if (!spec) return null;
        const isBusy = busyPreset === presetId;
        return (
          <Pressable
            key={presetId}
            testID={`${testIdPrefix}-${presetId}-btn`}
            accessibilityRole="button"
            accessibilityLabel={spec.fullLabel}
            disabled={busyPreset !== null}
            {...webTitle(spec.hint)}
            onPress={() => handleExport(presetId)}
            style={[
              compact ? styles.chipBtnCompact : styles.chipBtnFull,
              {
                borderColor: spec.accentColor,
                backgroundColor: spec.bgColor,
                opacity: busyPreset !== null && !isBusy ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: spec.accentColor }]}>
              {isBusy ? '⏳...' : compact ? spec.shortLabel : spec.fullLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  chipBtnCompact: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  chipBtnFull: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
