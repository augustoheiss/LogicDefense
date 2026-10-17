import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { PresenceBadges } from '../sync/PresenceBadges';

export interface StudioTopToolbarProps {
  onBack: () => void;
  onSelectPreset: (
    preset: 'fichas-4up' | 'territorios-multiciclo' | 's89-4up' | 's13-s' | 'auto'
  ) => void;
  onPickPdf: (mode: 'overlay' | 'rebuild') => void;
  onWebFileSelected: (bytes: Uint8Array, fileName: string, mode: 'overlay' | 'rebuild') => void;
  onDemoIngest: (mode: 'overlay' | 'rebuild') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  snapMm: number;
  onCycleSnap: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showRulers: boolean;
  onToggleRulers: () => void;
  onExport: (kind: 'pdf' | 'whatsapp' | 'csv' | 'yaml' | 'sdoc' | 'form-yaml') => void;
  onExportEditablePdf: () => void;
  hlcOpsCount: number;
  onExportHlcDelta: () => string;
  onImportHlcDelta: (envelopeStr: string) => void;
  bannerText: string | null;
  isErrorBanner?: boolean;
}

export function StudioTopToolbar({
  onBack,
  onSelectPreset,
  onPickPdf,
  onWebFileSelected,
  onDemoIngest,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  snapMm,
  onCycleSnap,
  showGrid,
  onToggleGrid,
  showRulers,
  onToggleRulers,
  onExport,
  onExportEditablePdf,
  hlcOpsCount,
  onExportHlcDelta,
  onImportHlcDelta,
  bannerText,
  isErrorBanner,
}: StudioTopToolbarProps) {
  const webUploadModeRef = useRef<'overlay' | 'rebuild'>('overlay');

  const triggerWebFileInput = (mode: 'overlay' | 'rebuild') => {
    webUploadModeRef.current = mode;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const el = document.getElementById('pdf-input') as HTMLInputElement | null;
      if (el) {
        el.value = '';
        el.click();
        return;
      }
    }
    onPickPdf(mode);
  };

  const handleWebInputChange = async (e: any) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    onWebFileSelected(
      new Uint8Array(buf),
      file.name || 'documento.pdf',
      webUploadModeRef.current
    );
  };

  return (
    <View style={styles.topBar}>
      {Platform.OS === 'web' &&
        React.createElement('input', {
          id: 'pdf-input',
          'data-testid': 'pdf-file-input',
          type: 'file',
          accept: 'application/pdf,.pdf',
          style: { display: 'none' },
          onChange: handleWebInputChange,
        })}

      <View style={styles.topRow}>
        <TouchableOpacity testID="studio-back-btn" style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Painel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🖋️ Estúdio YAML ⇄ PDF</Text>

        <TouchableOpacity
          testID="preset-s89-btn"
          style={styles.presetBtn}
          onPress={() => onSelectPreset('fichas-4up')}
        >
          <Text style={styles.presetBtnText}>📇 Fichas 4-Up (A4)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="preset-s13-btn"
          style={styles.presetBtn}
          onPress={() => onSelectPreset('territorios-multiciclo')}
        >
          <Text style={styles.presetBtnText}>🗺️ Territórios (Multi-Ciclo)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="preset-auto-btn"
          style={styles.presetBtn}
          onPress={() => onSelectPreset('auto')}
        >
          <Text style={styles.presetBtnText}>✨ Auto-Template</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="ingest-overlay-btn"
          style={[styles.presetBtn, styles.ingestBtn]}
          onPress={() => triggerWebFileInput('overlay')}
        >
          <Text style={styles.presetBtnText}>📥 Subir PDF (Fundo)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="ingest-rebuild-btn"
          style={[styles.presetBtn, styles.ingestBtn]}
          onPress={() => triggerWebFileInput('rebuild')}
        >
          <Text style={styles.presetBtnText}>🔬 Subir PDF (Rebuild)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="ingest-demo-rebuild-btn"
          style={[styles.presetBtn, styles.demoBtn]}
          onPress={() => onDemoIngest('rebuild')}
        >
          <Text style={styles.presetBtnText}>🧱 Demo PDF→YAML</Text>
        </TouchableOpacity>

        <PresenceBadges
          nodeId="node-studio"
          opsCount={hlcOpsCount}
          onExportDelta={onExportHlcDelta}
          onImportDelta={onImportHlcDelta}
        />
      </View>

      <View style={styles.subToolbar}>
        <View style={styles.toolGroup}>
          <TouchableOpacity
            testID="studio-undo-btn"
            disabled={!canUndo}
            style={[styles.smallBtn, !canUndo && styles.btnDisabled]}
            onPress={onUndo}
          >
            <Text style={styles.smallBtnText}>↩ Desfazer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="studio-redo-btn"
            disabled={!canRedo}
            style={[styles.smallBtn, !canRedo && styles.btnDisabled]}
            onPress={onRedo}
          >
            <Text style={styles.smallBtnText}>↪ Refazer</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="studio-snap-btn" style={styles.smallBtn} onPress={onCycleSnap}>
            <Text style={styles.smallBtnText}>
              🧲 Snap: {snapMm > 0 ? `${snapMm}mm` : 'Livre'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallBtn, showGrid && styles.smallBtnActive]}
            onPress={onToggleGrid}
          >
            <Text style={styles.smallBtnText}># Grade mm</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallBtn, showRulers && styles.smallBtnActive]}
            onPress={onToggleRulers}
          >
            <Text style={styles.smallBtnText}>📏 Réguas</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toolGroup}>
          <TouchableOpacity
            testID="export-pdf-btn"
            style={styles.exportPrimaryBtn}
            onPress={() => onExport('pdf')}
          >
            <Text style={styles.exportPrimaryText}>📄 Baixar PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="export-editable-pdf-btn"
            style={styles.exportEditableBtn}
            onPress={onExportEditablePdf}
          >
            <Text style={styles.exportSecondaryText}>📝 PDF Editável</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="export-sdoc-btn"
            style={styles.exportSecondaryBtn}
            onPress={() => onExport('sdoc')}
          >
            <Text style={styles.exportSecondaryText}>📜 .sdoc</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="export-csv-btn"
            style={styles.exportSecondaryBtn}
            onPress={() => onExport('csv')}
          >
            <Text style={styles.exportSecondaryText}>📊 .csv</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="export-yaml-btn"
            style={styles.exportSecondaryBtn}
            onPress={() => onExport('yaml')}
          >
            <Text style={styles.exportSecondaryText}>🌲 .data</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="export-whatsapp-btn"
            style={styles.exportSecondaryBtn}
            onPress={() => onExport('whatsapp')}
          >
            <Text style={styles.exportSecondaryText}>💬 Zap</Text>
          </TouchableOpacity>
        </View>
      </View>

      {bannerText && (
        <View
          style={[styles.statusBanner, isErrorBanner && styles.statusBannerError]}
          testID="studio-status-banner"
        >
          <Text
            style={[
              styles.statusBannerText,
              isErrorBanner && styles.statusBannerTextError,
            ]}
          >
            {bannerText}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  topRow: {
    width: '100%',
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  backBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  backBtnText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  title: { color: '#F8FAFC', fontSize: 13, fontWeight: '800', marginRight: 2 },
  presetBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  ingestBtn: { borderColor: '#3B82F6', backgroundColor: '#172554' },
  demoBtn: { borderColor: '#6366F1', backgroundColor: '#1E1B4B' },
  presetBtnText: { color: '#E2E8F0', fontSize: 10.5, fontWeight: '600' },
  subToolbar: {
    width: '100%',
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 5,
  },
  toolGroup: {
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  smallBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  smallBtnActive: { borderColor: '#3B82F6', backgroundColor: '#1E3A8A' },
  btnDisabled: { opacity: 0.4 },
  smallBtnText: { color: '#CBD5E1', fontSize: 10.5, fontWeight: '600' },
  exportPrimaryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  exportPrimaryText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  exportEditableBtn: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
  exportSecondaryBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  exportSecondaryText: { color: '#F0FDFA', fontSize: 10.5, fontWeight: '600' },
  statusBanner: {
    marginTop: 5,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  statusBannerError: {
    backgroundColor: '#450A0A',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  statusBannerText: { color: '#93C5FD', fontSize: 10.5 },
  statusBannerTextError: { color: '#FCA5A5', fontWeight: '700' },
});
