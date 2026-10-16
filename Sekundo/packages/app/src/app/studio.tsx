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
import { File as ExpoFile } from 'expo-file-system';
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
import { StudioTopToolbar } from '../components/studio/StudioTopToolbar';
import { QuickFillForm } from '../components/forms/QuickFillForm';

export default function StudioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; preset?: string }>();
  const eventId = params.id || 'seed-programacao';
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 960;
  const [mobileTab, setMobileTab] = useState<'fill' | 'yaml' | 'canvas' | 'inspector'>('canvas');
  const [rightSidebarTab, setRightSidebarTab] = useState<'fill' | 'inspector'>('fill');
  const [dataSourceMode, setDataSourceMode] = useState<'reuniao' | 'territorios' | 'avulso'>(
    params.preset === 's13-s' ? 'territorios' : 'reuniao'
  );

  const { flatRegistry } = useSkeleton(eventId);

  const effectiveRegistry = useMemo(() => {
    if (dataSourceMode === 'avulso') {
      return [];
    }
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
    preflight,
    underlayDataUrl,
    formValues,
    updateFormField,
    hlcOps,
    exportHlcDelta,
    importHlcDelta,
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
    exportEditableAcroFormPdf,
    ingestionStage,
    statusMessage,
    setStatusMessage,
  } = useSdocDocument({
    eventId,
    eventName: dataSourceMode === 'territorios' ? 'Territórios S-13-S' : 'Programação Semanal',
    registry: effectiveRegistry,
    initialPreset: params.preset === 's13-s' ? 's13-s' : 's89-4up',
  });

  const pages = displayList?.pages || [];
  const activePage = pages[Math.min(currentPageIndex, Math.max(0, pages.length - 1))] || null;
  const allPrimitives = useMemo(() => collectAllPrimitives(sdoc), [sdoc]);

  // C10: Never silently substitute a demo PDF if user upload fails — report clear error!
  const handlePickAndIngestPdf = async (mode: 'overlay' | 'rebuild') => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || !res.assets[0]) {
        return;
      }
      const asset = res.assets[0];
      let bytes: Uint8Array;
      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        bytes = new Uint8Array(await resp.arrayBuffer());
      } else {
        const file = new ExpoFile(asset.uri);
        bytes = await file.bytes();
      }
      setDataSourceMode('avulso');
      await ingestPdfBytes(bytes, mode, asset.name || 'importado.pdf');
    } catch (err: any) {
      setStatusMessage(`⚠️ Erro ao abrir o PDF selecionado: ${err?.message ?? err}`);
    }
  };

  const handleWebFileSelected = async (
    bytes: Uint8Array,
    fileName: string,
    mode: 'overlay' | 'rebuild'
  ) => {
    setDataSourceMode('avulso');
    await ingestPdfBytes(bytes, mode, fileName);
  };

  const handleDemoIngestPdf = async (mode: 'overlay' | 'rebuild') => {
    const { pdfBytes } = await compileSdocToPdf(S89_4UP_SDOC_YAML, effectiveRegistry.slice(0, 4));
    await ingestPdfBytes(pdfBytes, mode, 'S-89-Demo-Importado.pdf');
  };

  const handleSelectPreset = (preset: 's89-4up' | 's13-s' | 'auto') => {
    if (preset === 's89-4up') setDataSourceMode('reuniao');
    if (preset === 's13-s') setDataSourceMode('territorios');
    loadBuiltinPreset(preset);
  };

  const bannerText = ingestionStage
    ? `⏳ ${ingestionStage}`
    : parseError
    ? `⚠️ YAML: ${parseError}`
    : layoutError
    ? `⚠️ Layout: ${layoutError}`
    : statusMessage
    ? statusMessage
    : null;

  const isErrorBanner = Boolean(
    parseError || layoutError || (statusMessage && statusMessage.startsWith('⚠️'))
  );

  return (
    <SafeAreaView style={styles.root}>
      <StudioTopToolbar
        onBack={() => (router.canGoBack() ? router.back() : router.push('/'))}
        onSelectPreset={handleSelectPreset}
        onPickPdf={handlePickAndIngestPdf}
        onWebFileSelected={handleWebFileSelected}
        onDemoIngest={handleDemoIngestPdf}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        snapMm={snapMm}
        onCycleSnap={() => setSnapMm(snapMm === 1 ? 5 : snapMm === 5 ? 0 : 1)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        showRulers={showRulers}
        onToggleRulers={() => setShowRulers(!showRulers)}
        onExport={exportDocument}
        onExportEditablePdf={exportEditableAcroFormPdf}
        hlcOpsCount={hlcOps.length}
        onExportHlcDelta={exportHlcDelta}
        onImportHlcDelta={importHlcDelta}
        bannerText={bannerText}
        isErrorBanner={isErrorBanner}
      />

      {!isWide && (
        <View style={styles.mobileTabBar}>
          {(['fill', 'canvas', 'yaml', 'inspector'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              testID={`mobile-tab-${t}`}
              style={[styles.mobileTabBtn, mobileTab === t && styles.mobileTabBtnActive]}
              onPress={() => setMobileTab(t)}
            >
              <Text style={styles.mobileTabText}>
                {t === 'fill'
                  ? '⚡ Preencher'
                  : t === 'yaml'
                  ? '📝 YAML'
                  : t === 'canvas'
                  ? '🖼️ Canvas'
                  : '🎛️ Inspetor'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
                  {activePage ? ` (${activePage.widthMm}×${activePage.heightMm}mm)` : ''}
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
                        underlayDataUrl={underlayDataUrl}
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

        {/* Right Pane: QuickFillForm + Layer/Property Inspector */}
        {(isWide || mobileTab === 'fill' || mobileTab === 'inspector') && (
          <View style={[styles.inspectorPane, !isWide && styles.fullPane]}>
            {isWide && (
              <View style={styles.sidebarSwitchBar}>
                <TouchableOpacity
                  testID="sidebar-tab-fill"
                  style={[
                    styles.sidebarSwitchBtn,
                    rightSidebarTab === 'fill' && styles.sidebarSwitchBtnActive,
                  ]}
                  onPress={() => setRightSidebarTab('fill')}
                >
                  <Text style={styles.sidebarSwitchText}>
                    ⚡ Preencher ({sdoc?.fields?.length || 0})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="sidebar-tab-inspector"
                  style={[
                    styles.sidebarSwitchBtn,
                    rightSidebarTab === 'inspector' && styles.sidebarSwitchBtnActive,
                  ]}
                  onPress={() => setRightSidebarTab('inspector')}
                >
                  <Text style={styles.sidebarSwitchText}>🎛️ Inspetor</Text>
                </TouchableOpacity>
              </View>
            )}

            {(isWide ? rightSidebarTab === 'fill' : mobileTab === 'fill') ? (
              <QuickFillForm
                sdoc={sdoc}
                values={formValues}
                onChangeField={updateFormField}
                preflight={preflight}
                onExportFlattenedPdf={() => exportDocument('pdf')}
                onExportEditablePdf={exportEditableAcroFormPdf}
                onExportFormYaml={() => exportDocument('form-yaml')}
                onSelectFieldOnCanvas={(fieldId, pageNum) => {
                  setSelectedId(fieldId);
                  if (pageNum && pageNum >= 1) {
                    setCurrentPageIndex(pageNum - 1);
                  }
                }}
              />
            ) : (
              <StudioInspectorPanel
                sdoc={sdoc}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdatePrimitive={updatePrimitive}
                onAddPrimitive={addPrimitive}
              />
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1120' },
  mobileTabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  mobileTabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  mobileTabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#3B82F6' },
  mobileTabText: { color: '#E2E8F0', fontSize: 11.5, fontWeight: '600' },
  workspace: { flex: 1, flexDirection: 'row' },
  fullPane: { flex: 1, width: '100%' },
  yamlPane: {
    width: 330,
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
    width: 310,
    borderLeftWidth: 1,
    borderLeftColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  sidebarSwitchBar: {
    flexDirection: 'row',
    backgroundColor: '#090D16',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  sidebarSwitchBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  sidebarSwitchBtnActive: {
    borderBottomColor: '#3B82F6',
    backgroundColor: '#0F172A',
  },
  sidebarSwitchText: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
});
