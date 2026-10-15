import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import {
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
  compileSdocToPdf,
  S89_4UP_SDOC_YAML,
} from '@sekundo/core';
import { useSkeleton } from '../hooks/useSkeleton';
import { useSdocDocument } from '../hooks/useSdocDocument';
import { SvgPainter } from '../components/studio/SvgPainter';
import { MmTopRuler, MmLeftRuler, RULER_THICKNESS } from '../components/studio/MmRulers';
import {
  StudioInspectorPanel,
  collectAllPrimitives,
} from '../components/studio/StudioSidebars';

export default function StudioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; preset?: string }>();
  const eventId = params.id || 'seed-programacao';
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 960;
  const [mobileTab, setMobileTab] = useState<'yaml' | 'canvas' | 'inspector'>('canvas');
  const [dataSourceMode, setDataSourceMode] = useState<'reuniao' | 'territorios'>(
    params.preset === 's13-s' ? 'territorios' : 'reuniao'
  );

  const { flatRegistry } = useSkeleton(eventId);

  const effectiveRegistry = useMemo(() => {
    if (flatRegistry && flatRegistry.length > 0 && dataSourceMode === 'reuniao') {
      return flatRegistry;
    }
    if (dataSourceMode === 'territorios') {
      return buildTerritoriosS13HistoricalRegistry();
    }
    return buildProgramacaoReuniaoRegistry();
  }, [flatRegistry, dataSourceMode]);

  const {
    yamlText,
    setYamlText,
    sdoc,
    parseError,
    displayList,
    layoutError,
    currentPageIndex,
    setCurrentPageIndex,
    selectedId,
    setSelectedId,
    snapMm,
    setSnapMm,
    showGrid,
    setShowGrid,
    showRulers,
    setShowRulers,
    zoom,
    setZoom,
    undo,
    redo,
    canUndo,
    canRedo,
    updatePrimitive,
    addPrimitive,
    loadBuiltinPreset,
    ingestPdfBytes,
    exportDocument,
    ingestionStage,
    statusMessage,
  } = useSdocDocument({
    eventId,
    eventName: dataSourceMode === 'territorios' ? 'Territórios S-13-S' : 'Programação Semanal',
    registry: effectiveRegistry,
    initialPreset: params.preset === 's13-s' ? 's13-s' : 's89-4up',
  });

  const pages = displayList?.pages || [];
  const activePage = pages[Math.min(currentPageIndex, Math.max(0, pages.length - 1))] || null;
  const allPrimitives = useMemo(() => collectAllPrimitives(sdoc), [sdoc]);

  const handlePickAndIngestPdf = async (mode: 'overlay' | 'rebuild') => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        const resp = await fetch(asset.uri);
        const buf = await resp.arrayBuffer();
        await ingestPdfBytes(new Uint8Array(buf), mode, asset.name || 'importado.pdf');
      }
    } catch {
      // Fallback to demo PDF ingestion
      await handleDemoIngestPdf(mode);
    }
  };

  const handleDemoIngestPdf = async (mode: 'overlay' | 'rebuild') => {
    const { pdfBytes } = await compileSdocToPdf(S89_4UP_SDOC_YAML, effectiveRegistry.slice(0, 4));
    await ingestPdfBytes(pdfBytes, mode, 'S-89-Demo-Importado.pdf');
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Top Studio Header */}
      <View style={styles.topBar}>
        <View style={styles.topRow}>
          <TouchableOpacity
            testID="studio-back-btn"
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.push('/'))}
          >
            <Text style={styles.backBtnText}>← Painel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🖋️ Estúdio Documental YAML ⇄ PDF</Text>

          {/* Preset Loaders */}
          <TouchableOpacity
            testID="preset-s89-btn"
            style={styles.presetBtn}
            onPress={() => {
              setDataSourceMode('reuniao');
              loadBuiltinPreset('s89-4up');
            }}
          >
            <Text style={styles.presetBtnText}>📇 S-89 (4-Up A4)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="preset-s13-btn"
            style={styles.presetBtn}
            onPress={() => {
              setDataSourceMode('territorios');
              loadBuiltinPreset('s13-s');
            }}
          >
            <Text style={styles.presetBtnText}>🗺️ S-13-S (Multi-Ciclo)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="preset-auto-btn"
            style={styles.presetBtn}
            onPress={() => loadBuiltinPreset('auto')}
          >
            <Text style={styles.presetBtnText}>✨ Auto-Template</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="ingest-overlay-btn"
            style={[styles.presetBtn, styles.ingestBtn]}
            onPress={() => handlePickAndIngestPdf('overlay')}
          >
            <Text style={styles.presetBtnText}>📥 Subir PDF (Fundo)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="ingest-demo-rebuild-btn"
            style={[styles.presetBtn, styles.ingestBtn]}
            onPress={() => handleDemoIngestPdf('rebuild')}
          >
            <Text style={styles.presetBtnText}>🧱 Demo Ingestão PDF→YAML</Text>
          </TouchableOpacity>
        </View>

        {/* Second Toolbar Row: Undo/Redo, Snap, Rulers & Unified Outputs */}
        <View style={styles.subToolbar}>
          <View style={styles.toolGroup}>
            <TouchableOpacity
              testID="studio-undo-btn"
              disabled={!canUndo}
              style={[styles.smallBtn, !canUndo && styles.btnDisabled]}
              onPress={undo}
            >
              <Text style={styles.smallBtnText}>↩ Desfazer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="studio-redo-btn"
              disabled={!canRedo}
              style={[styles.smallBtn, !canRedo && styles.btnDisabled]}
              onPress={redo}
            >
              <Text style={styles.smallBtnText}>↪ Refazer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="studio-snap-btn"
              style={styles.smallBtn}
              onPress={() => setSnapMm(snapMm === 1 ? 5 : snapMm === 5 ? 0 : 1)}
            >
              <Text style={styles.smallBtnText}>
                🧲 Snap: {snapMm > 0 ? `${snapMm}mm` : 'Livre'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallBtn, showGrid && styles.smallBtnActive]}
              onPress={() => setShowGrid(!showGrid)}
            >
              <Text style={styles.smallBtnText}># Grade mm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallBtn, showRulers && styles.smallBtnActive]}
              onPress={() => setShowRulers(!showRulers)}
            >
              <Text style={styles.smallBtnText}>📏 Réguas</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toolGroup}>
            <TouchableOpacity
              testID="export-pdf-btn"
              style={styles.exportPrimaryBtn}
              onPress={() => exportDocument('pdf')}
            >
              <Text style={styles.exportPrimaryText}>📄 Baixar PDF Vetorial</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="export-sdoc-btn"
              style={styles.exportSecondaryBtn}
              onPress={() => exportDocument('sdoc')}
            >
              <Text style={styles.exportSecondaryText}>📜 .sdoc.yaml</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="export-yaml-btn"
              style={styles.exportSecondaryBtn}
              onPress={() => exportDocument('yaml')}
            >
              <Text style={styles.exportSecondaryText}>🌲 .data.yaml</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="export-whatsapp-btn"
              style={styles.exportSecondaryBtn}
              onPress={() => exportDocument('whatsapp')}
            >
              <Text style={styles.exportSecondaryText}>💬 WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        {(ingestionStage || statusMessage || parseError || layoutError) && (
          <View style={styles.statusBanner} testID="studio-status-banner">
            <Text style={styles.statusBannerText}>
              {ingestionStage
                ? `⏳ ${ingestionStage}`
                : parseError
                ? `⚠️ YAML: ${parseError}`
                : layoutError
                ? `⚠️ Layout: ${layoutError}`
                : `✅ ${statusMessage}`}
            </Text>
          </View>
        )}
      </View>

      {/* Mobile Tab Switcher when screen is narrow */}
      {!isWide && (
        <View style={styles.mobileTabBar}>
          {(['yaml', 'canvas', 'inspector'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.mobileTabBtn, mobileTab === t && styles.mobileTabBtnActive]}
              onPress={() => setMobileTab(t)}
            >
              <Text style={styles.mobileTabText}>
                {t === 'yaml' ? '📝 YAML' : t === 'canvas' ? '🖼️ Canvas mm' : '🎛️ Inspetor'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 3-Pane Studio Workspace */}
      <View style={styles.workspace}>
        {/* Left Pane: YAML Source Editor */}
        {(isWide || mobileTab === 'yaml') && (
          <View style={[styles.yamlPane, !isWide && styles.fullPane]}>
            <View style={styles.paneHeader}>
              <Text style={styles.paneHeaderTitle}>📝 Código-Fonte (.sdoc.yaml)</Text>
              <Text style={styles.paneHeaderMeta}>
                {parseError ? '❌ Erro' : `✅ ${displayList?.stats.primitives ?? 0} ops`}
              </Text>
            </View>
            <TextInput
              testID="studio-yaml-editor"
              style={styles.yamlInput}
              multiline
              value={yamlText}
              onChangeText={setYamlText}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
          </View>
        )}

        {/* Center Pane: Interactive SVG Canvas + Millimeter Rulers */}
        {(isWide || mobileTab === 'canvas') && (
          <View style={[styles.canvasPane, !isWide && styles.fullPane]}>
            <View style={styles.canvasHeader}>
              <View style={styles.pageNav}>
                <TouchableOpacity
                  testID="prev-page-btn"
                  disabled={currentPageIndex <= 0}
                  style={styles.pageBtn}
                  onPress={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                >
                  <Text style={styles.pageBtnText}>◀</Text>
                </TouchableOpacity>
                <Text style={styles.pageIndicator} testID="studio-page-indicator">
                  Página {pages.length > 0 ? currentPageIndex + 1 : 0} de {pages.length}
                </Text>
                <TouchableOpacity
                  testID="next-page-btn"
                  disabled={currentPageIndex >= pages.length - 1}
                  style={styles.pageBtn}
                  onPress={() =>
                    setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))
                  }
                >
                  <Text style={styles.pageBtnText}>▶</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.pageNav}>
                <TouchableOpacity
                  style={styles.pageBtn}
                  onPress={() => setZoom(Math.max(0.5, Number((zoom - 0.15).toFixed(2))))}
                >
                  <Text style={styles.pageBtnText}>🔍 -</Text>
                </TouchableOpacity>
                <Text style={styles.pageIndicator}>{Math.round(zoom * 100)}%</Text>
                <TouchableOpacity
                  style={styles.pageBtn}
                  onPress={() => setZoom(Math.min(2.0, Number((zoom + 0.15).toFixed(2))))}
                >
                  <Text style={styles.pageBtnText}>🔍 +</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.canvasScroll}
              contentContainerStyle={styles.canvasScrollContent}
            >
              <ScrollView horizontal contentContainerStyle={styles.canvasScrollHorizontal}>
                {activePage ? (
                  <View>
                    {showRulers && (
                      <View style={{ flexDirection: 'row' }}>
                        <View style={styles.rulerCorner}>
                          <Text style={styles.rulerCornerText}>mm</Text>
                        </View>
                        <MmTopRuler widthMm={activePage.widthMm} zoom={zoom} />
                      </View>
                    )}
                    <View style={{ flexDirection: 'row' }}>
                      {showRulers && <MmLeftRuler heightMm={activePage.heightMm} zoom={zoom} />}
                      <SvgPainter
                        page={activePage}
                        primitives={allPrimitives}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onUpdatePrimitive={updatePrimitive}
                        snapMm={snapMm}
                        showGrid={showGrid}
                        zoom={zoom}
                      />
                    </View>
                  </View>
                ) : (
                  <Text style={styles.emptyCanvasText}>Nenhuma página para renderizar.</Text>
                )}
              </ScrollView>
            </ScrollView>
          </View>
        )}

        {/* Right Pane: Layer Tree & Property Inspector */}
        {(isWide || mobileTab === 'inspector') && (
          <View style={[styles.inspectorPane, !isWide && styles.fullPane]}>
            <StudioInspectorPanel
              sdoc={sdoc}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdatePrimitive={updatePrimitive}
              onAddPrimitive={addPrimitive}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1120' },
  topBar: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  backBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  backBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  title: { color: '#F8FAFC', fontSize: 15, fontWeight: '800', marginRight: 8 },
  presetBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  ingestBtn: { borderColor: '#3B82F6', backgroundColor: '#172554' },
  presetBtnText: { color: '#E2E8F0', fontSize: 11, fontWeight: '600' },
  subToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  toolGroup: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  smallBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  smallBtnActive: { borderColor: '#3B82F6', backgroundColor: '#1E3A8A' },
  btnDisabled: { opacity: 0.4 },
  smallBtnText: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  exportPrimaryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  exportPrimaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  exportSecondaryBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  exportSecondaryText: { color: '#F0FDFA', fontSize: 11, fontWeight: '600' },
  statusBanner: {
    marginTop: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
  },
  statusBannerText: { color: '#93C5FD', fontSize: 11 },
  mobileTabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  mobileTabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  mobileTabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#3B82F6' },
  mobileTabText: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  workspace: { flex: 1, flexDirection: 'row' },
  fullPane: { flex: 1, width: '100%' },
  yamlPane: {
    width: 340,
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
    backgroundColor: '#090D16',
  },
  paneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  paneHeaderTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  paneHeaderMeta: { color: '#38BDF8', fontSize: 11, fontFamily: 'monospace' },
  yamlInput: {
    flex: 1,
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11.5,
    padding: 10,
    textAlignVertical: 'top',
  },
  canvasPane: { flex: 1, backgroundColor: '#1E293B' },
  canvasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  pageNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pageBtnText: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
  pageIndicator: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  canvasScroll: { flex: 1 },
  canvasScrollContent: { padding: 16, alignItems: 'center' },
  canvasScrollHorizontal: { alignItems: 'flex-start' },
  rulerCorner: {
    width: RULER_THICKNESS,
    height: RULER_THICKNESS,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  rulerCornerText: { color: '#64748B', fontSize: 8, fontWeight: '700' },
  emptyCanvasText: { color: '#94A3B8', marginTop: 40, fontSize: 13 },
  inspectorPane: {
    width: 300,
    borderLeftWidth: 1,
    borderLeftColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
});
