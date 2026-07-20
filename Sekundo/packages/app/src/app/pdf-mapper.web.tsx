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
import type { FlatSkeletonEntry, TemplateCoordinateMap } from '@sekundo/core';

// Dynamically load PDF.js from cdnjs inside the browser to avoid bundle bloat
const loadPdfJs = async (): Promise<any> => {
  if (typeof window === 'undefined') return null;
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
};

interface PinnedCoord {
  key: string;
  label: string;
  x: number;
  y: number;
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
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);
  const [rendering, setRendering] = useState(false);

  // Mapping coordinate state
  const [coords, setCoords] = useState<PinnedCoord[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<FlatSkeletonEntry | null>(null);
  const [tempClick, setTempClick] = useState<{ x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load PDF.js dependency on mount
  useEffect(() => {
    loadPdfJs()
      .then(() => setPdfJsLoaded(true))
      .catch((e) => console.error('[Sekundo] Failed to load PDF.js:', e));
  }, []);

  // Fetch saved coordinate map for this template when document loads
  useEffect(() => {
    if (pdfFile) {
      // Simulate file hash prefix for localStorage mapping key
      const fileKey = `hash_${pdfFile.name}_${pdfFile.size}`;
      loadPDFMap(fileKey).then((savedMap) => {
        if (savedMap) {
          const list: PinnedCoord[] = Object.entries(savedMap).map(([key, item]) => ({
            key,
            label: item.label,
            x: item.x,
            y: item.y,
            page: item.page,
          }));
          setCoords(list);
        } else {
          setCoords([]);
        }
      });
    }
  }, [pdfFile]);

  // Render current PDF page onto the HTML5 Canvas
  const renderPage = async (pageIndex: number, doc: any) => {
    if (!doc || !canvasRef.current || rendering) return;

    setRendering(true);
    try {
      const page = await doc.getPage(pageIndex);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Use 1.5x scale for clean visibility
      const viewport = page.getViewport({ scale: 1.5 });
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
      
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
        const pdfjsLib = (window as any).pdfjsLib;
        try {
          const doc = await pdfjsLib.getDocument({ data: typedarray }).promise;
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          renderPage(1, doc);
        } catch (err) {
          alert('Cannot load PDF document.');
        }
      };
      fileReader.readAsArrayBuffer(file);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || rendering) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Coordinates relative to canvas viewport
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    setTempClick({ x: clickX, y: clickY });
    setSelectedEntry(null);
    setSearchQuery('');
  };

  const handleSavePin = () => {
    if (!tempClick || !selectedEntry) return;

    // Check if key already mapped on this template
    const filtered = coords.filter((c) => c.key !== selectedEntry.key);

    const newPin: PinnedCoord = {
      key: selectedEntry.key,
      label: selectedEntry.label,
      x: Math.round(tempClick.x),
      y: Math.round(tempClick.y),
      page: pageNum,
    };

    setCoords([...filtered, newPin]);
    setTempClick(null);
    setSelectedEntry(null);
  };

  const handleSaveMap = async () => {
    if (!pdfFile) return;
    const fileKey = `hash_${pdfFile.name}_${pdfFile.size}`;

    // Convert PinnedCoord list back to TemplateCoordinateMap schema
    const mapSchema: TemplateCoordinateMap = {};
    for (const c of coords) {
      mapSchema[c.key] = {
        x: c.x,
        y: c.y,
        page: c.page,
        printMode: 'valueOnly',
        label: c.label,
        fontSize: 10,
      };
    }

    await savePDFMap(fileKey, mapSchema);
    alert('Coordinate Map saved successfully to local storage!');
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
          <Text style={styles.eventTitle}>PDF Coordinate Mapper</Text>
          {pdfFile ? (
            <Text style={styles.fileName}>({pdfFile.name})</Text>
          ) : null}
        </View>
        <View style={styles.actionRight}>
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
            <Text style={styles.primaryActionBtnText}>Save Map</Text>
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

                {/* Render coordinate dots overlay */}
                {coords
                  .filter((c) => c.page === pageNum)
                  .map((c) => (
                    <div
                      key={c.key}
                      style={{
                        position: 'absolute',
                        left: `${c.x}px`,
                        top: `${c.y}px`,
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
                          {c.label} ({c.key})
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
                  ))}

                {/* Render temporary click pin */}
                {tempClick ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${tempClick.x}px`,
                      top: `${tempClick.y}px`,
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
                Click coordinates: X: {tempClick.x}, Y: {tempClick.y} (Page {pageNum})
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
