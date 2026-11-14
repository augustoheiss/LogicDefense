/**
 * Component: GranularExportModal
 *
 * Sliced export interface for Sekundo skeletons ("Exportação por Partes / LEGO"):
 *   - Scope: All, Leaves only, Branches only, Worked only, Pending only
 *   - Branch Filter: Entire Event or specific subtree (e.g. only '01-01')
 *   - Format: Canonical (with _meta_json) vs. Clean Human (agent/user-friendly)
 *   - Delimiter: Comma (,) vs. Semicolon (;)
 * Includes live preview, instant clipboard copy, and file download.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import {
  exportGranularCSV,
  filterGranularEntries,
  registryToYaml,
  pathKey,
  type FlatRegistry,
  type EngineId,
  type GranularScope,
  type TransformerConfig,
} from '@sekundo/core';
import { deliverFile } from '../../utils/deliverFile';
import {
  buildTerritoryExportPayloadByPreset,
  type TerritoryExportPresetId,
} from '../../utils/territoryExportDelivery';

interface GranularExportModalProps {
  visible: boolean;
  onClose: () => void;
  flatRegistry: FlatRegistry;
  eventName: string;
  engineId?: EngineId;
  transformerConfig?: TransformerConfig;
}

type GranularModalFormat =
  | 'canonical'
  | 'clean_human'
  | 'yaml_tree'
  | 'yaml_flat'
  | TerritoryExportPresetId;

export function GranularExportModal({
  visible,
  onClose,
  flatRegistry,
  eventName,
  engineId = 'territory_logistics',
  transformerConfig,
}: GranularExportModalProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [scope, setScope] = useState<GranularScope>('all');
  const [format, setFormat] = useState<GranularModalFormat>('clean_human');
  const [delimiter, setDelimiter] = useState<',' | ';'>(';');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const isYamlMode = format === 'yaml_tree' || format === 'yaml_flat';
  const isCsvLegacyMode = format === 'clean_human' || format === 'canonical';
  const isPresetMode = !isYamlMode && !isCsvLegacyMode;

  // Extract distinct branch and root candidates for subtree filtering
  const branchOptions = useMemo(() => {
    const list: { key: string; label: string; depth: number }[] = [
      { key: 'all', label: 'Todo o Evento (Árvore Completa)', depth: 0 },
    ];

    // Collect keys with depth <= 2 or that have children
    const keysWithChildren = new Set<string>();
    for (const item of flatRegistry) {
      const p = pathKey.parent(item.key);
      if (p) keysWithChildren.add(p);
    }

    for (const item of flatRegistry) {
      const d = pathKey.depth(item.key);
      if (d <= 2 || keysWithChildren.has(item.key)) {
        list.push({
          key: item.key,
          label: `${item.key} - ${item.label || 'Sem rótulo'}`,
          depth: d,
        });
      }
    }

    return list;
  }, [flatRegistry]);

  // Compute filtered items count
  const matchingEntries = useMemo(() => {
    return filterGranularEntries(flatRegistry, {
      branchPrefix: selectedBranch === 'all' ? undefined : selectedBranch,
      scope,
    });
  }, [flatRegistry, selectedBranch, scope]);

  // Generate sliced CSV, YAML, or Multi-Format payload & preview
  const generatedResult = useMemo(() => {
    const branchPrefix = selectedBranch === 'all' ? undefined : selectedBranch;
    const safePrefix = eventName.replace(/\s+/g, '_') || 'sekundo';
    const branchSuffix = selectedBranch === 'all' ? 'completo' : `parte_${selectedBranch}`;

    if (isPresetMode) {
      try {
        const nodesForPreset = matchingEntries.length > 0 ? matchingEntries : flatRegistry;
        const payload = buildTerritoryExportPayloadByPreset(
          nodesForPreset,
          format as TerritoryExportPresetId,
          { privacySafeMode: true }
        );
        const isBinary = Boolean(payload.bytes && payload.bytes.length > 0);
        return {
          text: isBinary
            ? `Arquivo binário pronto (${payload.fileName} • ${payload.bytes!.length} bytes • ${matchingEntries.length} nós filtrados). Clique em "Baixar" abaixo.`
            : payload.text || '',
          copyableText: isBinary ? null : payload.text || '',
          bytes: payload.bytes,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          formatLabel: payload.format.toUpperCase(),
          isBinary,
        };
      } catch (err: any) {
        return {
          text: `⚠️ Erro ao gerar visualização: ${err?.message || 'dados insuficientes'}`,
          copyableText: null,
          bytes: undefined,
          fileName: `${safePrefix}_${branchSuffix}.txt`,
          mimeType: 'text/plain;charset=utf-8',
          formatLabel: 'ERRO',
          isBinary: false,
        };
      }
    }

    if (format === 'yaml_tree' || format === 'yaml_flat') {
      const yaml = registryToYaml(flatRegistry, {
        branchPrefix,
        scope,
        yamlFormat: format === 'yaml_tree' ? 'tree' : 'flat',
        eventName,
      });
      return {
        text: yaml,
        copyableText: yaml,
        bytes: undefined,
        fileName: `${safePrefix}_${branchSuffix}_${format}.data.yaml`,
        mimeType: 'text/yaml;charset=utf-8;',
        formatLabel: 'YAML',
        isBinary: false,
      };
    }

    const csv = exportGranularCSV(flatRegistry, {
      branchPrefix,
      scope,
      format: format as 'clean_human' | 'canonical',
      delimiter,
      engineId,
      transformerConfig,
    });
    return {
      text: csv,
      copyableText: csv,
      bytes: undefined,
      fileName: `${safePrefix}_${branchSuffix}_${format}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      formatLabel: 'CSV',
      isBinary: false,
    };
  }, [
    flatRegistry,
    matchingEntries,
    selectedBranch,
    scope,
    format,
    isPresetMode,
    delimiter,
    engineId,
    transformerConfig,
    eventName,
  ]);

  const generatedOutput = generatedResult.text;

  const handleDownload = async () => {
    const content = generatedResult.bytes ?? generatedResult.text;
    await deliverFile(content, generatedResult.fileName, generatedResult.mimeType);
  };

  const handleCopy = () => {
    if (Platform.OS === 'web' && navigator.clipboard && generatedResult.copyableText) {
      navigator.clipboard.writeText(generatedResult.copyableText);
      setCopyFeedback(`${generatedResult.formatLabel} copiado com sucesso!`);
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  };

  const scopeOptions: { key: GranularScope; label: string; desc: string }[] = [
    { key: 'all', label: 'Tudo', desc: 'Ramos e folhas' },
    { key: 'leaves_only', label: 'Apenas Folhas', desc: 'Casas / Tarefas finais' },
    { key: 'branches_only', label: 'Apenas Ramos', desc: 'Quadras / Agrupadores' },
    { key: 'worked_only', label: 'Trabalhados', desc: 'Status = 1 ou Concluído' },
    { key: 'pending_only', label: 'Pendentes', desc: 'Status = 0 ou Não trabalhado' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>📤 Exportação Granular por Partes (LEGO)</Text>
              <Text style={styles.subtitle}>
                Exporte fatias específicas do evento para editar separadamente sem risco de quebrar o restante.
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea}>
            {/* 1. Branch / Subtree Selector */}
            <Text style={styles.sectionLabel}>1. SUBÁRVORE / RAMO ESPECÍFICO:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
              {branchOptions.map((b) => {
                const isSelected = selectedBranch === b.key;
                return (
                  <Pressable
                    key={b.key}
                    onPress={() => setSelectedBranch(b.key)}
                    style={[styles.chip, isSelected && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {b.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 2. Scope Selector */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>2. ESCOPO DOS NÓS:</Text>
            <View style={styles.optionsRow}>
              {scopeOptions.map((opt) => {
                const isSelected = scope === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setScope(opt.key)}
                    style={[styles.scopeBtn, isSelected && styles.scopeBtnActive]}
                  >
                    <Text style={[styles.scopeBtnLabel, isSelected && styles.scopeBtnLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.scopeBtnDesc}>{opt.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 3. Format & Delimiter */}
            <View style={styles.formatDelimRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>
                  3. FORMATO DE SAÍDA (CSV, YAML, XLSX, KML, GEOJSON, ZIP):
                </Text>
                <View style={styles.radioGroup}>
                  {(
                    [
                      { key: 'clean_human', label: '✨ CSV Limpo / Humano (Sem JSON)' },
                      { key: 'canonical', label: '📦 CSV Canônico (Com _meta_json)' },
                      { key: 'yaml_tree', label: '🌲 YAML em Árvore (data.yaml — Recomendado)' },
                      { key: 'yaml_flat', label: '📄 YAML Plano (data.yaml — Espelho CSV)' },
                      { key: 'zip_gis', label: '🧩 Pacote GIS (.ZIP Individual + Consolidado)' },
                      { key: 'kml_numbered', label: '🏷️ .KML Polígonos Numerados (Limpo p/ Mapas)' },
                      { key: 'kml_full', label: '🗺️ .KML Quadras / Bairros' },
                      { key: 'geojson_gis', label: '🌍 .GeoJSON Polígonos Numerados' },
                      { key: 'xlsx_18col', label: '📊 Planilha Excel (.XLSX 18 Colunas)' },
                      { key: 'json', label: '📦 Backup Estruturado (.JSON)' },
                    ] as { key: GranularModalFormat; label: string }[]
                  ).map((opt) => (
                    <Pressable
                      key={opt.key}
                      testID={`granular-format-${opt.key}`}
                      onPress={() => setFormat(opt.key)}
                      style={[styles.radioItem, format === opt.key && styles.radioItemActive]}
                    >
                      <Text style={[styles.radioText, format === opt.key && styles.radioTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {isCsvLegacyMode && (
                <View style={{ width: 140 }}>
                  <Text style={styles.sectionLabel}>DELIMITADOR:</Text>
                  <View style={styles.radioGroup}>
                    <Pressable
                      onPress={() => setDelimiter(';')}
                      style={[styles.radioItem, delimiter === ';' && styles.radioItemActive]}
                    >
                      <Text style={[styles.radioText, delimiter === ';' && styles.radioTextActive]}>
                        Ponto e vírgula (;)
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setDelimiter(',')}
                      style={[styles.radioItem, delimiter === ',' && styles.radioItemActive]}
                    >
                      <Text style={[styles.radioText, delimiter === ',' && styles.radioTextActive]}>
                        Vírgula (,)
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* Sliced Preview Box */}
            <View style={styles.previewBox}>
              <View style={styles.previewBoxHeader}>
                <Text style={styles.previewCount}>
                  Contém {matchingEntries.length} nós nesta parte ({generatedResult.formatLabel})
                </Text>
                {copyFeedback && <Text style={styles.copyFeedbackText}>{copyFeedback}</Text>}
              </View>
              <ScrollView horizontal style={styles.previewScrollX}>
                <Text style={styles.previewCode}>
                  {generatedOutput.split('\n').slice(0, 12).join('\n')}
                  {generatedOutput.split('\n').length > 12 ? '\n... (mais linhas na exportação)' : ''}
                </Text>
              </ScrollView>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            {generatedResult.copyableText !== null && (
              <Pressable onPress={handleCopy} style={styles.btnOutline}>
                <Text style={styles.btnOutlineText}>📋 Copiar {generatedResult.formatLabel}</Text>
              </Pressable>
            )}
            <Pressable onPress={handleDownload} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>
                📥 Baixar {generatedResult.formatLabel} ({matchingEntries.length} nós)
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: '#161922',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8A94A6',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#8A94A6',
    fontSize: 18,
  },
  scrollArea: {
    padding: 20,
  },
  sectionLabel: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  horizontalChips: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  chipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  chipText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#34D399',
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scopeBtn: {
    flex: 1,
    minWidth: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  scopeBtnActive: {
    borderColor: '#FFB800',
    backgroundColor: 'rgba(255, 184, 0, 0.08)',
  },
  scopeBtnLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  scopeBtnLabelActive: {
    color: '#FFB800',
  },
  scopeBtnDesc: {
    color: '#6F7E94',
    fontSize: 10,
    marginTop: 2,
  },
  formatDelimRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  radioGroup: {
    gap: 6,
  },
  radioItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  radioItemActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  radioText: {
    color: '#8A94A6',
    fontSize: 12,
  },
  radioTextActive: {
    color: '#93C5FD',
    fontWeight: '600',
  },
  previewBox: {
    marginTop: 18,
    backgroundColor: '#0D1017',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
  },
  previewBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewCount: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  copyFeedbackText: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '600',
  },
  previewScrollX: {
    maxHeight: 120,
  },
  previewCode: {
    color: '#A9B4C5',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#12151C',
  },
  btnOutline: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  btnOutlineText: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
  },
  btnPrimary: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  btnPrimaryText: {
    color: '#12151C',
    fontSize: 13,
    fontWeight: '700',
  },
});
