/**
 * Shared Cross-Platform Territory Multi-Format Export Delivery Helper
 *
 * Centralizes delivering `.xlsx`, `.kml` (standard or territory-numbered polygon-only),
 * `.geojson` (standard or external GIS consolidated), `.zip` (per-territory non-destructive GIS bundle),
 * `.json`, `.csv` (18-col & 19-col) via `@sekundo/core` + `deliverFile`.
 */

import {
  exportTerritoryMultiFormat,
  selectEnginePartitionNodes,
  stripSampleTerritorySeedNodes,
  type FlatSkeletonEntry,
  type TerritoryMultiExportPayload,
} from '@sekundo/core';
import { loadSavedTerritoryRegistry } from '../storage/omniStorageBridge';
import { deliverFile } from './deliverFile';

export type TerritoryExportPresetId =
  | 'xlsx_18col'
  | 'kml_numbered'
  | 'kml_full'
  | 'geojson'
  | 'geojson_gis'
  | 'zip_gis'
  | 'json'
  | 'csv_18col'
  | 'csv_19col';

export interface DeliverTerritoryExportOptions {
  privacySafeMode?: boolean;
  includeKmlPoints?: boolean;
  excludeTerritoryNumbers?: string[];
  documentName?: string;
}

export interface DeliverTerritoryExportResult {
  delivered: boolean;
  payload?: TerritoryMultiExportPayload;
  message: string;
}

export function buildTerritoryExportPayloadByPreset(
  nodes: FlatSkeletonEntry[],
  preset: TerritoryExportPresetId,
  options: DeliverTerritoryExportOptions = {}
): TerritoryMultiExportPayload {
  const privacySafeMode = options.privacySafeMode !== false;

  switch (preset) {
    case 'xlsx_18col':
      return exportTerritoryMultiFormat(nodes, {
        format: 'xlsx',
        spreadsheetSchema: 'external_18col',
        privacySafeMode,
      });
    case 'kml_numbered':
      return exportTerritoryMultiFormat(nodes, {
        format: 'kml',
        consolidateByTerritory: true,
        kmlLabelMode: 'territory_number',
        includeKmlPoints: false,
        privacySafeMode,
        excludeTerritoryNumbers: options.excludeTerritoryNumbers,
        documentName: options.documentName,
      });
    case 'kml_full':
      return exportTerritoryMultiFormat(nodes, {
        format: 'kml',
        consolidateByTerritory: false,
        kmlLabelMode: 'full',
        includeKmlPoints: Boolean(options.includeKmlPoints),
        privacySafeMode,
        excludeTerritoryNumbers: options.excludeTerritoryNumbers,
        documentName: options.documentName,
      });
    case 'geojson_gis':
      return exportTerritoryMultiFormat(nodes, {
        format: 'geojson',
        consolidateByTerritory: true,
        geojsonProfile: 'external_gis',
        includeGeoJsonPoints: false,
        privacySafeMode,
        excludeTerritoryNumbers: options.excludeTerritoryNumbers,
      });
    case 'geojson':
      return exportTerritoryMultiFormat(nodes, {
        format: 'geojson',
        consolidateByTerritory: false,
        geojsonProfile: 'standard',
        privacySafeMode,
        excludeTerritoryNumbers: options.excludeTerritoryNumbers,
      });
    case 'zip_gis':
      return exportTerritoryMultiFormat(nodes, {
        format: 'zip',
        privacySafeMode,
        excludeTerritoryNumbers: options.excludeTerritoryNumbers,
        documentName: options.documentName,
      });
    case 'json':
      return exportTerritoryMultiFormat(nodes, {
        format: 'json',
        privacySafeMode,
      });
    case 'csv_18col':
      return exportTerritoryMultiFormat(nodes, {
        format: 'csv',
        spreadsheetSchema: 'external_18col',
        privacySafeMode,
      });
    case 'csv_19col':
    default:
      return exportTerritoryMultiFormat(nodes, {
        format: 'csv',
        spreadsheetSchema: 'sekundo_19col',
        privacySafeMode,
      });
  }
}

export async function resolveEffectiveTerritoryNodes(
  nodes?: FlatSkeletonEntry[]
): Promise<FlatSkeletonEntry[]> {
  if (nodes && nodes.length > 0) {
    const partition = selectEnginePartitionNodes(nodes, 'territory_logistics');
    const candidate = partition.length > 0 ? partition : nodes;
    const realOnly = stripSampleTerritorySeedNodes(candidate);
    if (realOnly.length > 0) return realOnly;
    return candidate;
  }
  const saved = await loadSavedTerritoryRegistry();
  if (saved && saved.length > 0) {
    const realOnly = stripSampleTerritorySeedNodes(saved);
    return realOnly.length > 0 ? realOnly : saved;
  }
  return [];
}

export async function deliverTerritoryMultiFormatPreset(
  nodes: FlatSkeletonEntry[] | undefined,
  preset: TerritoryExportPresetId,
  options: DeliverTerritoryExportOptions = {}
): Promise<DeliverTerritoryExportResult> {
  const effectiveNodes = await resolveEffectiveTerritoryNodes(nodes);
  if (effectiveNodes.length === 0) {
    return {
      delivered: false,
      message: '⚠️ Nenhum território salvo ou carregado para exportar.',
    };
  }

  const payload = buildTerritoryExportPayloadByPreset(effectiveNodes, preset, options);
  const content = payload.bytes ?? payload.text ?? '';
  await deliverFile(content, payload.fileName, payload.mimeType);

  const privacyLabel = payload.privacySanitized ? ' com Escudo LGPD ativo' : '';
  return {
    delivered: true,
    payload,
    message: `📥 Arquivo "${payload.fileName}" exportado (${payload.format.toUpperCase()})${privacyLabel}!`,
  };
}
