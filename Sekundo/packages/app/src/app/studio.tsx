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
import { StudioInspectorPanel, collectAllPrimitives } from '../components/studio/StudioSidebars';
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
    if (dataSourceMode === 'avulso') return [];
    if (flatRegistry && flatRegistry.length > 0 && dataSourceMode === 'reuniao') return flatRegistry;
    return dataSourceMode === 'territorios'
      ? buildTerritoriosS13HistoricalRegistry()
      : buildProgramacaoReuniaoRegistry();
  }, [flatRegistry, dataSourceMode]);

  const doc = useSdocDocument({
    eventId,
    eventName: dataSourceMode === 'territorios' ? 'Territórios S-13-S' : 'Programação Semanal',
    registry: effectiveRegistry,
    initialPreset: params.preset === 's13-s' ? 's13-s' : 's89-4up',
  });

  const pages = doc.displayList?.pages || [];
  const activePage = pages[Math.min(doc.currentPageIndex, Math.max(0, pages.length - 1))] || null;
  const allPrimitives = useMemo(() => collectAllPrimitives(doc.sdoc), [doc.sdoc]);

  const handlePickAndIngestPdf = async (mode: 'overlay' | 'rebuild') => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const bytes =
        Platform.OS === 'web'
          ? new Uint8Array(await (await fetch(asset.uri)).arrayBuffer())
          : await new ExpoFile(asset.uri).bytes();
      setDataSourceMode('avulso');
      await doc.ingestPdfBytes(bytes, mode, asset.name || 'importado.pdf');
      if (!isWide && mode === 'overlay') setMobileTab('fill');
    } catch (err: any) {
      doc.setStatusMessage(`⚠️ Erro ao abrir o PDF selecionado: ${err?.message ?? err}`);
    }
  };

  const handleWebFileSelected = async (
    bytes: Uint8Array,
    fileName: string,
    mode: 'overlay' | 'rebuild'
  ) => {
    setDataSourceMode('avulso');
    await doc.ingestPdfBytes(bytes, mode, fileName);
    if (!isWide && mode === 'overlay') setMobileTab('fill');
  };

  const handleDemoIngestPdf = async (mode: 'overlay' | 'rebuild') => {
    const { pdfBytes } = await compileSdocToPdf(S89_4UP_SDOC_YAML, effectiveRegistry.slice(0, 4));
    await doc.ingestPdfBytes(pdfBytes, mode, 'S-89-Demo-Importado.pdf');
  };

  const handleSelectPreset = (preset: 's89-4up' | 's13-s' | 'auto') => {
    if (preset === 's89-4up') setDataSourceMode('reuniao');
    if (preset === 's13-s') setDataSourceMode('territorios');
    doc.loadBuiltinPreset(preset);
  };

  const bannerText = doc.ingestionStage
    ? `⏳ ${doc.ingestionStage}`
    : doc.parseError
    ? `⚠️ YAML: ${doc.parseError}`
    : doc.layoutError
    ? `⚠️ Layout: ${doc.layoutError}`
    : doc.statusMessage || null;

  const isErrorBanner = Boolean(
    doc.parseError || doc.layoutError || (doc.statusMessage && doc.statusMessage.startsWith('⚠️'))
  );

  const renderPageHeaderBar = () => (
    <View style={styles.canvasHeader}>
      <View style={styles.pageNav}>
        <TouchableOpacity
          testID="prev-page-btn"
          disabled={doc.currentPageIndex <= 0}
          style={styles.pageBtn}
          onPress={() => doc.setCurrentPageIndex(Math.max(0, doc.currentPageIndex - 1))}
        >
          <Text style={styles.pageBtnText}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.pageIndicator} testID="studio-page-indicator">
          Página {pages.length > 0 ? doc.currentPageIndex + 1 : 0} de {pages.length}
          {activePage ? ` (${activePage.widthMm}×${activePage.heightMm}mm)` : ''}
        </Text>
        <TouchableOpacity
          testID="next-page-btn"
          disabled={doc.currentPageIndex >= pages.length - 1}
          style={styles.pageBtn}
          onPress={() =>
            doc.setCurrentPageIndex(Math.min(pages.length - 1, doc.currentPageIndex + 1))
          }
        >
          <Text style={styles.pageBtnText}>▶</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.pageNav}>
        <TouchableOpacity
          style={styles.pageBtn}
          onPress={() => doc.setZoom(Math.max(0.5, Number((doc.zoom - 0.15).toFixed(2))))}
        >
          <Text style={styles.pageBtnText}>🔍 -</Text>
        </TouchableOpacity>
        <Text style={styles.pageIndicator}>{Math.round(doc.zoom * 100)}%</Text>
        <TouchableOpacity
          style={styles.pageBtn}
          onPress={() => doc.setZoom(Math.min(2.0, Number((doc.zoom + 0.15).toFixed(2))))}
        >
          <Text style={styles.pageBtnText}>🔍 +</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderQuickFill = () => (
    <QuickFillForm
      sdoc={doc.sdoc}
      values={doc.formValues}
      onChangeField={doc.updateFormField}
      preflight={doc.preflight}
      onExportFlattenedPdf={() => doc.exportDocument('pdf')}
      onExportEditablePdf={doc.exportEditableAcroFormPdf}
      onExportUnsignedCopy={doc.exportUnsignedCopy}
      onExportFormYaml={() => doc.exportDocument('form-yaml')}
      onSelectFieldOnCanvas={(fieldId, pageNum) => {
        doc.setSelectedId(fieldId);
        if (pageNum && pageNum >= 1) doc.setCurrentPageIndex(pageNum - 1);
      }}
    />
  );

  const showQuickFillInMobileInspector =
    !isWide && mobileTab === 'inspector' && (doc.sdoc?.fields?.length ?? 0) > 0 && !doc.selectedId;

  return (
    <SafeAreaView style={styles.root}>
      <StudioTopToolbar
        onBack={() => (router.canGoBack() ? router.back() : router.push('/'))}
        onSelectPreset={handleSelectPreset}
        onPickPdf={handlePickAndIngestPdf}
        onWebFileSelected={handleWebFileSelected}
        onDemoIngest={handleDemoIngestPdf}
        canUndo={doc.canUndo}
        canRedo={doc.canRedo}
        onUndo={doc.undo}
        onRedo={doc.redo}
        snapMm={doc.snapMm}
        onCycleSnap={() => doc.setSnapMm(doc.snapMm === 1 ? 5 : doc.snapMm === 5 ? 0 : 1)}
        showGrid={doc.showGrid}
        onToggleGrid={() => doc.setShowGrid(!doc.showGrid)}
        showRulers={doc.showRulers}
        onToggleRulers={() => doc.setShowRulers(!doc.showRulers)}
        onExport={doc.exportDocument}
        onExportEditablePdf={doc.exportEditableAcroFormPdf}
        hlcOpsCount={doc.hlcOps.length}
        onExportHlcDelta={doc.exportHlcDelta}
        onImportHlcDelta={doc.importHlcDelta}
        bannerText={bannerText}
        isErrorBanner={isErrorBanner}
      />

      {!isWide && (
        <>
          <View style={styles.mobileTabBar}>
            {(['fill', 'canvas', 'yaml', 'inspector'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                testID={`mobile-tab-${t}`}
                style={[styles.mobileTabBtn, mobileTab === t && styles.mobileTabBtnActive]}
                onPress={() => setMobileTab(t)}
                {...(Platform.OS === 'web'
                  ? ({ onClick: () => setMobileTab(t), onTouchEnd: () => setMobileTab(t) } as any)
                  : {})}
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
          {renderPageHeaderBar()}
        </>
      )}

      <View style={styles.workspace}>
        {(isWide || mobileTab === 'yaml') && (
          <View style={[styles.yamlPane, !isWide && styles.fullPane]}>
            <View style={styles.paneHeader}>
              <Text style={styles.paneHeaderTitle}>📝 Código-Fonte (.sdoc.yaml)</Text>
              <Text style={styles.paneHeaderMeta}>
                {doc.parseError ? '❌ Erro' : `✅ ${doc.displayList?.stats.primitives ?? 0} ops`}
              </Text>
            </View>
            <TextInput
              testID="studio-yaml-editor"
              style={styles.yamlInput}
              multiline
              value={doc.yamlText}
              onChangeText={doc.setYamlText}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
          </View>
        )}

        {(isWide || mobileTab === 'canvas') && (
          <View style={[styles.canvasPane, !isWide && styles.fullPane]}>
            {isWide && renderPageHeaderBar()}
            <ScrollView
              style={styles.canvasScroll}
              contentContainerStyle={[
                styles.canvasScrollContent,
                !isWide && styles.canvasScrollContentMobile,
              ]}
            >
              <ScrollView horizontal contentContainerStyle={styles.canvasScrollHorizontal}>
                {activePage ? (
                  <View>
                    {doc.showRulers && (
                      <View style={{ flexDirection: 'row' }}>
                        <View style={styles.rulerCorner}>
                          <Text style={styles.rulerCornerText}>mm</Text>
                        </View>
                        <MmTopRuler widthMm={activePage.widthMm} zoom={doc.zoom} />
                      </View>
                    )}
                    <View style={{ flexDirection: 'row' }}>
                      {doc.showRulers && (
                        <MmLeftRuler heightMm={activePage.heightMm} zoom={doc.zoom} />
                      )}
                      <SvgPainter
                        page={activePage}
                        primitives={allPrimitives}
                        selectedId={doc.selectedId}
                        onSelect={doc.setSelectedId}
                        onUpdatePrimitive={doc.updatePrimitive}
                        snapMm={doc.snapMm}
                        showGrid={doc.showGrid}
                        zoom={doc.zoom}
                        underlayDataUrl={doc.underlayDataUrl}
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
                    ⚡ Preencher ({doc.sdoc?.fields?.length || 0})
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

            {(isWide ? rightSidebarTab === 'fill' : mobileTab === 'fill') ||
            showQuickFillInMobileInspector ? (
              renderQuickFill()
            ) : (
              <StudioInspectorPanel
                sdoc={doc.sdoc}
                selectedId={doc.selectedId}
                onSelect={doc.setSelectedId}
                onUpdatePrimitive={doc.updatePrimitive}
                onAddPrimitive={doc.addPrimitive}
              />
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: '100%', overflow: 'hidden', backgroundColor: '#0B1120' },
  mobileTabBar: { width: '100%', flexDirection: 'row', backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  mobileTabBtn: { flex: 1, paddingVertical: 7, alignItems: 'center' },
  mobileTabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#3B82F6' },
  mobileTabText: { color: '#E2E8F0', fontSize: 11, fontWeight: '600' },
  workspace: { flex: 1, width: '100%', maxWidth: '100%', overflow: 'hidden', flexDirection: 'row' },
  fullPane: { flex: 1, width: '100%', maxWidth: '100%', overflow: 'hidden' },
  yamlPane: { width: 330, borderRightWidth: 1, borderRightColor: '#1E293B', backgroundColor: '#090D16' },
  paneHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#0F172A', borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  paneHeaderTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  paneHeaderMeta: { color: '#38BDF8', fontSize: 11, fontFamily: 'monospace' },
  yamlInput: { flex: 1, color: '#E2E8F0', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11.5, padding: 10, textAlignVertical: 'top' },
  canvasPane: { flex: 1, maxWidth: '100%', overflow: 'hidden', backgroundColor: '#1E293B' },
  canvasHeader: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#0F172A', borderBottomWidth: 1, borderBottomColor: '#1E293B', gap: 4 },
  pageNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageBtn: { backgroundColor: '#1E293B', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  pageBtnText: { color: '#E2E8F0', fontSize: 10.5, fontWeight: '700' },
  pageIndicator: { color: '#CBD5E1', fontSize: 10.5, fontWeight: '600' },
  canvasScroll: { flex: 1, width: '100%' },
  canvasScrollContent: { padding: 16, alignItems: 'center' },
  canvasScrollContentMobile: { padding: 4, alignItems: 'flex-start' },
  canvasScrollHorizontal: { alignItems: 'flex-start' },
  rulerCorner: { width: RULER_THICKNESS, height: RULER_THICKNESS, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#334155' },
  rulerCornerText: { color: '#64748B', fontSize: 8, fontWeight: '700' },
  emptyCanvasText: { color: '#94A3B8', marginTop: 40, fontSize: 13 },
  inspectorPane: { width: 310, borderLeftWidth: 1, borderLeftColor: '#1E293B', backgroundColor: '#0F172A' },
  sidebarSwitchBar: { flexDirection: 'row', backgroundColor: '#090D16', borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  sidebarSwitchBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sidebarSwitchBtnActive: { borderBottomColor: '#3B82F6', backgroundColor: '#0F172A' },
  sidebarSwitchText: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
});
