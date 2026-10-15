/**
 * Page: pdf-mapper.web
 *
 * Web-exclusive PDF Coordinate Mapper.
 * Loads PDF.js dynamically, renders PDF pages onto an HTML5 Canvas,
 * tracks mouse click coordinates, and binds coordinates to Skeleton path keys
 * using the FieldAutoComplete selector.
 */

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { FieldAutoComplete } from '../components/ui/FieldAutoComplete';
import { savePDFMap, loadPDFMap } from '../storage/localStorage';
import { loadPdfJsLocalFirst } from '../pdf/pdfjsLoader';
import { deliverFile } from '../utils/deliverFile';
import {
  computeTemplateFingerprintSha256,
  stampCoordinateMapOnPDF,
  ptToMm,
  mmToPt,
  type FlatSkeletonEntry,
  type TemplateCoordinateMap,
} from '@sekundo/core';

const VIEWPORT_SCALE = 1.5;

interface PinnedCoord {
  key: string;
  label: string;
  /** X in millimeters from left edge */
  xMm: number;
  /** Y in millimeters from top edge */
  yMm: number;
  page: number;
}

export default function PDFMapperWeb() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events } = useLocalEvent();
  const event = events.find((e) => e.config.id === eventId);
  const { flatRegistry, loading: skeletonLoading } = useSkeleton(eventId);

  // States
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [templateHash, setTemplateHash] = useState<string>('');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);
  const [rendering, setRendering] = useState(false);

  // Mapping coordinate state (stored in canonical mm from top-left)
  const [coords, setCoords] = useState<PinnedCoord[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<FlatSkeletonEntry | null>(null);
  const [tempClick, setTempClick] = useState<{ xMm: number; yMm: number; pxX: number; pxY: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load PDF.js dependency on mount (local-first with CDN fallback)
  useEffect(() => {
    loadPdfJsLocalFirst()
      .then(() => setPdfJsLoaded(true))
      .catch((e) => console.error('[Sekundo] Failed to load PDF.js:', e));
  }, []);

  // Fetch saved coordinate map for this template by SHA-256 hash
  useEffect(() => {
    if (templateHash) {
      loadPDFMap(templateHash).then((savedMap) => {
        if (savedMap) {
          const list: PinnedCoord[] = Object.entries(savedMap).map(([key, item]) => ({
            key,
            label: item.label,
            xMm: item.unit === 'pt' ? Number(ptToMm(item.x).toFixed(2)) : item.x,
            yMm: item.unit === 'pt' ? Number(ptToMm(item.y).toFixed(2)) : item.y,
            page: item.page,
          }));
          setCoords(list);
        } else {
          setCoords([]);
        }
      });
    }
  }, [templateHash]);

  // Render current PDF page onto the HTML5 Canvas
  const renderPage = async (pageIndex: number, doc: any) => {
    if (!doc || !canvasRef.current || rendering) return;

    setRendering(true);
    try {
      const page = await doc.getPage(pageIndex);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      const viewport = page.getViewport({ scale: VIEWPORT_SCALE });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        await page.render(renderContext).promise;
      }
    } catch (err) {
      console.error('[Sekundo] PDF page render error:', err);
    } finally {
      setRendering(false);
    }
  };

  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNum, pdfDoc);
    }
  }, [pageNum, pdfDoc]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      setPageNum(1);

      const buffer = await file.arrayBuffer();
      const typedarray = new Uint8Array(buffer);
      setPdfBytes(typedarray);
      const sha = await computeTemplateFingerprintSha256(typedarray);
      setTemplateHash(sha);

      const pdfjsLib = await loadPdfJsLocalFirst();
      try {
        const doc = await pdfjsLib.getDocument({ data: typedarray.slice(0) }).promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        renderPage(1, doc);
      } catch {
        alert('Cannot load PDF document.');
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || rendering) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Canvas pixel coordinates -> unscaled PDF points -> physical millimeters (top-left origin)
    const clickPxX = e.clientX - rect.left;
    const clickPxY = e.clientY - rect.top;
    const xMm = Number(ptToMm(clickPxX / VIEWPORT_SCALE).toFixed(2));
    const yMm = Number(ptToMm(clickPxY / VIEWPORT_SCALE).toFixed(2));

    setTempClick({ xMm, yMm, pxX: Math.round(clickPxX), pxY: Math.round(clickPxY) });
    setSelectedEntry(null);
    setSearchQuery('');
  };

  const handleSavePin = () => {
    if (!tempClick || !selectedEntry) return;

    const filtered = coords.filter((c) => c.key !== selectedEntry.key);

    const newPin: PinnedCoord = {
      key: selectedEntry.key,
      label: selectedEntry.label,
      xMm: tempClick.xMm,
      yMm: tempClick.yMm,
      page: pageNum,
    };

    setCoords([...filtered, newPin]);
    setTempClick(null);
    setSelectedEntry(null);
  };

  const buildMapSchema = (): TemplateCoordinateMap => {
    const mapSchema: TemplateCoordinateMap = {};
    for (const c of coords) {
      mapSchema[c.key] = {
        x: c.xMm,
        y: c.yMm,
        unit: 'mm',
        page: c.page,
        printMode: 'valueOnly',
        label: c.label,
        fontSize: 10,
      };
    }
    return mapSchema;
  };

  const handleSaveMap = async () => {
    if (!pdfFile || !templateHash) return;
    const mapSchema = buildMapSchema();
    await savePDFMap(templateHash, mapSchema);
    alert(`Mapa de coordenadas salvo em mm (${templateHash.slice(0, 18)}…)!`);
  };

  const handleExportStampedPDF = async () => {
    if (!pdfBytes || coords.length === 0) return;
    const mapSchema = buildMapSchema();
    if (templateHash) {
      await savePDFMap(templateHash, mapSchema);
    }
    const { pdfBytes: outBytes } = await stampCoordinateMapOnPDF(pdfBytes, mapSchema, flatRegistry);
    const cleanName = pdfFile ? pdfFile.name.replace(/\.pdf$/i, '') : 'Template';
    await deliverFile(outBytes, `${cleanName}_Carimbado.pdf`, 'application/pdf');
  };

  const deletePin = (keyToDelete: string) => {
    setCoords(coords.filter((c) => c.key !== keyToDelete));
  };

  if (skeletonLoading || !event) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top action bar */}
      <View style={styles.actionBar}>
        <View style={styles.actionLeft}>
          <Pressable
            onPress={() => router.replace(`/skeleton-editor?id=${eventId}`)}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Editor</Text>
          </Pressable>
          <Text style={styles.eventTitle}>PDF Coordinate Mapper (mm)</Text>
          {pdfFile ? (
            <Text style={styles.fileName}>({pdfFile.name})</Text>
          ) : null}
        </View>
        <View style={styles.actionRight}>
          <Pressable
            onPress={() => router.push(`/studio?id=${eventId}` as any)}
            style={[styles.actionBtn, { marginRight: 8, borderColor: '#8B5CF6', borderWidth: 1 }]}
          >
            <Text style={[styles.actionBtnText, { color: '#C4B5FD' }]}>🖋️ Estúdio YAML</Text>
          </Pressable>
          <Pressable
            onPress={() => fileInputRef.current?.click()}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnText}>Upload template PDF</Text>
          </Pressable>
          <Pressable
            disabled={!pdfFile || coords.length === 0}
            onPress={handleSaveMap}
            style={[styles.primaryActionBtn, (!pdfFile || coords.length === 0) && styles.btnDisabled]}
          >
            <Text style={styles.primaryActionBtnText}>Salvar Mapa (mm)</Text>
          </Pressable>
          <Pressable
            disabled={!pdfBytes || coords.length === 0}
            onPress={handleExportStampedPDF}
            style={[
              styles.primaryActionBtn,
              { backgroundColor: '#10B981' },
              (!pdfBytes || coords.length === 0) && styles.btnDisabled,
            ]}
          >
            <Text style={styles.primaryActionBtnText}>⚡ Baixar PDF Carimbado</Text>
          </Pressable>
        </View>
      </View>

      <input
        type="file"
        accept=".pdf"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <View style={styles.workspace}>
        {/* PDF Canvas area */}
        <View style={styles.canvasContainer}>
          {!pdfFile ? (
            <View style={styles.emptyCanvasCard}>
              <Text style={styles.emptyTitle}>No Template Loaded</Text>
              <Text style={styles.emptySub}>
                Upload a flat PDF template sheet to begin coordinate structural mapping.
              </Text>
            </View>
          ) : (
            <View style={styles.canvasWrapper}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  style={{
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    cursor: 'crosshair',
                  }}
                />

                {/* Render coordinate dots overlay (converted from mm to canvas px) */}
                {coords
                  .filter((c) => c.page === pageNum)
                  .map((c) => {
                    const pxLeft = Math.round(mmToPt(c.xMm) * VIEWPORT_SCALE);
                    const pxTop = Math.round(mmToPt(c.yMm) * VIEWPORT_SCALE);
                    return (
                      <div
                        key={c.key}
                        style={{
                          position: 'absolute',
                          left: `${pxLeft}px`,
                          top: `${pxTop}px`,
                          transform: 'translate(-50%, -50%)',
                          display: 'flex',
                          alignItems: 'center',
                          zIndex: 10,
                        }}
                      >
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: '#8B5CF6',
                            border: '2px solid #FFFFFF',
                            boxShadow: '0 0 8px rgba(139, 92, 246, 0.8)',
                          }}
                        />
                        <div
                          style={{
                            backgroundColor: '#1E232F',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '4px 6px',
                            marginLeft: '8px',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ color: '#FFFFFF', fontSize: '10px', fontWeight: 'bold' }}>
                            {c.label} ({c.xMm}×{c.yMm}mm)
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePin(c.key);
                            }}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: '#EF4444',
                              marginLeft: '6px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '11px',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {/* Render temporary click pin */}
                {tempClick ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${tempClick.pxX}px`,
                      top: `${tempClick.pxY}px`,
                      transform: 'translate(-50%, -50%)',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: '#FFB800',
                      border: '2px solid #FFFFFF',
                      boxShadow: '0 0 8px rgba(255, 184, 0, 0.8)',
                    }}
                  />
                ) : null}
              </div>

              {/* Page Controls */}
              <View style={styles.paginationBar}>
                <Pressable
                  disabled={pageNum <= 1}
                  onPress={() => setPageNum(pageNum - 1)}
                  style={[styles.pageBtn, pageNum <= 1 && styles.btnDisabled]}
                >
                  <Text style={styles.pageBtnText}>Previous</Text>
                </Pressable>
                <Text style={styles.paginationText}>
                  Page {pageNum} of {totalPages}
                </Text>
                <Pressable
                  disabled={pageNum >= totalPages}
                  onPress={() => setPageNum(pageNum + 1)}
                  style={[styles.pageBtn, pageNum >= totalPages && styles.btnDisabled]}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Pin Creator Sidebar Panel */}
        <View style={styles.sidebar}>
          <Text style={styles.sidebarTitle}>Pin Mapping Properties</Text>
          {tempClick ? (
            <View style={styles.sidebarForm}>
              <Text style={styles.sidebarHelp}>
                Coordenadas (mm, topo-esquerdo): X: {tempClick.xMm} mm, Y: {tempClick.yMm} mm (Pág. {pageNum})
              </Text>
              
              <Text style={styles.sidebarLabel}>BIND TO SKELETON FIELD</Text>
              <FieldAutoComplete
                flatRegistry={flatRegistry}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSelect={(entry) => {
                  setSelectedEntry(entry);
                  setSearchQuery(`${entry.label} (${entry.key})`);
                }}
                placeholder="Search slot label..."
              />

              <Pressable
                onPress={handleSavePin}
                disabled={!selectedEntry}
                style={[styles.savePinBtn, !selectedEntry && styles.btnDisabled]}
              >
                <Text style={styles.savePinBtnText}>Bind Coordinates</Text>
              </Pressable>
              
              <Pressable onPress={() => setTempClick(null)} style={styles.cancelPinBtn}>
                <Text style={styles.cancelPinBtnText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.sidebarEmpty}>
              <Text style={styles.sidebarHelp}>
                Click anywhere on the PDF sheet canvas area to drop a pinpoint, then bind it to a skeleton slot key.
              </Text>

              {coords.length > 0 ? (
                <View style={styles.mappedListContainer}>
                  <Text style={styles.mappedHeader}>Mapped Keys ({coords.length})</Text>
                  <ScrollView style={styles.mappedScroll}>
                    {coords.map((c) => (
                      <View key={c.key} style={styles.mappedItem}>
                        <View>
                          <Text style={styles.mappedItemLabel}>{c.label}</Text>
                          <Text style={styles.mappedItemKey}>
                            {c.key} (Page {c.page})
                          </Text>
                        </View>
                        <Pressable onPress={() => deletePin(c.key)}>
                          <Text style={styles.mappedItemDelete}>Remove</Text>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 16,
  },
  backBtnText: {
    color: '#8A94A6',
    fontSize: 14,
    fontWeight: '500',
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  fileName: {
    color: '#8A94A6',
    fontSize: 14,
    marginLeft: 8,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryActionBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginLeft: 10,
  },
  primaryActionBtnText: {
    color: '#12151C',
    fontWeight: '600',
    fontSize: 13,
  },
  actionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionBtnText: {
    color: '#A9B4C5',
    fontSize: 13,
    fontWeight: '500',
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
  },
  canvasContainer: {
    flex: 3,
    backgroundColor: '#0F1116',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  canvasWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCanvasCard: {
    alignItems: 'center',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySub: {
    color: '#6F7E94',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  pageBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 12,
  },
  pageBtnText: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  paginationText: {
    color: '#8A94A6',
    fontSize: 12,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  sidebar: {
    flex: 1,
    backgroundColor: '#161922',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 12,
  },
  sidebarForm: {
    width: '100%',
  },
  sidebarHelp: {
    color: '#8A94A6',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  sidebarLabel: {
    color: '#6F7E94',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  savePinBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  savePinBtnText: {
    color: '#12151C',
    fontWeight: '700',
    fontSize: 13,
  },
  cancelPinBtn: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelPinBtnText: {
    color: '#8A94A6',
    fontWeight: '600',
    fontSize: 13,
  },
  sidebarEmpty: {
    flex: 1,
  },
  mappedListContainer: {
    flex: 1,
    marginTop: 24,
  },
  mappedHeader: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mappedScroll: {
    flex: 1,
  },
  mappedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  mappedItemLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  mappedItemKey: {
    color: '#6F7E94',
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  mappedItemDelete: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
  },
});
