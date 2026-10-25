/**
 * Sekundo — Quick Share Sheet (`Phase F1 & F2`: Scoped Zero-Bureaucracy Capability Links)
 *
 * Allows an operator to share 1 or N specific territories, weeks, or groups in 1 tap:
 *   - Multi-select chips (e.g. Territórios 01, 02, 05 — only those 3 are projected; the other 13 are 100% excluded)
 *   - Access mode toggle: `👁️ Só ver` (`#r=<readKey>`) vs `✏️ Pode marcar progresso` (`#r=<readKey>&w=<signSeed>`)
 *   - Opt-in notes toggle (`includeNotes: false` by default — `SEC-06`)
 *   - Generates a compact Capability URL (`<= 200 chars`) with keys strictly in the `#` fragment
 *   - Uploads the AES-256-GCM encrypted blob to the stateless relay (`PUT /signal/share/blob/{id}`)
 *     and caches locally (`sekundo:cap_blob:${id}`) for instant offline/local preview.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  createCapabilityLink,
  resolveTerritoryKeysForNumbers,
  extractTerritorySummaries,
  type FlatSkeletonEntry,
  type ShareAccessMode,
  type ShareScopeKind,
  type CapabilityLinkArtifacts,
} from '@sekundo/core';
import { API, getHeaders } from '../../config/api';
import { shareLocationPayload } from '../../storage/omniStorageBridge';

const Colors = {
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
};
const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};
const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
};
const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export interface QuickShareSheetProps {
  visible: boolean;
  onClose: () => void;
  eventId?: string;
  eventTitle?: string;
  skeleton: FlatSkeletonEntry[];
  initialScopeKind?: ShareScopeKind;
  /** Pre-selected territory numbers (e.g. ['04']) or root keys */
  initialSelectedTerritoryNumbers?: string[];
  initialSelectedKeys?: string[];
  initialTitle?: string;
}

export const CAPABILITY_LOCAL_CACHE_PREFIX = 'sekundo:cap_blob:';

export function saveCapabilityBlobToLocalCache(blobId: string, cipherBlob: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`${CAPABILITY_LOCAL_CACHE_PREFIX}${blobId}`, cipherBlob);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function loadCapabilityBlobFromLocalCache(blobId: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(`${CAPABILITY_LOCAL_CACHE_PREFIX}${blobId}`);
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

export function QuickShareSheet({
  visible,
  onClose,
  eventId = 'default',
  eventTitle = 'Compartilhamento Sekundo',
  skeleton,
  initialScopeKind = 'territories',
  initialSelectedTerritoryNumbers = [],
  initialSelectedKeys = [],
  initialTitle,
}: QuickShareSheetProps) {
  const router = useRouter();

  const territorySummaries = useMemo(
    () => extractTerritorySummaries(skeleton || []),
    [skeleton]
  );

  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    for (const entry of skeleton || []) {
      const meta = (entry.meta || {}) as Record<string, any>;
      const dateStr = String(meta.date || meta.week || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        weeks.add(dateStr);
      }
    }
    return Array.from(weeks).sort();
  }, [skeleton]);

  const [scopeKind, setScopeKind] = useState<ShareScopeKind>(initialScopeKind);
  const [selectedTerritoryNums, setSelectedTerritoryNums] = useState<string[]>(
    initialSelectedTerritoryNumbers
  );
  const [selectedWeekDates, setSelectedWeekDates] = useState<string[]>([]);
  const [accessMode, setAccessMode] = useState<ShareAccessMode>('edit');
  const [includeNotes, setIncludeNotes] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedLink, setGeneratedLink] = useState<CapabilityLinkArtifacts | null>(null);
  const [relayStatus, setRelayStatus] = useState<'idle' | 'uploaded' | 'local_only'>('idle');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setScopeKind(initialScopeKind);
      if (initialSelectedTerritoryNumbers.length > 0) {
        setSelectedTerritoryNums(initialSelectedTerritoryNumbers);
      } else if (territorySummaries.length > 0 && selectedTerritoryNums.length === 0) {
        setSelectedTerritoryNums([territorySummaries[0].territoryNumber]);
      }
      if (availableWeeks.length > 0 && selectedWeekDates.length === 0) {
        setSelectedWeekDates([availableWeeks[0]]);
      }
      setGeneratedLink(null);
      setRelayStatus('idle');
      setFeedbackBanner(null);
    }
  }, [visible, initialScopeKind]);

  const toggleTerritoryNum = (num: string) => {
    setGeneratedLink(null);
    setSelectedTerritoryNums((prev) =>
      prev.includes(num) ? prev.filter((item) => item !== num) : [...prev, num]
    );
  };

  const toggleWeekDate = (weekIso: string) => {
    setGeneratedLink(null);
    setSelectedWeekDates((prev) =>
      prev.includes(weekIso) ? prev.filter((w) => w !== weekIso) : [...prev, weekIso]
    );
  };

  const resolvedKeys = useMemo(() => {
    if (scopeKind === 'territories') {
      const fromNums = resolveTerritoryKeysForNumbers(skeleton || [], selectedTerritoryNums);
      if (fromNums.length > 0) return fromNums;
      return initialSelectedKeys.length > 0 ? initialSelectedKeys : selectedTerritoryNums;
    }
    if (scopeKind === 'weeks') {
      return selectedWeekDates.length > 0 ? selectedWeekDates : ['*'];
    }
    if (initialSelectedKeys.length > 0) {
      return initialSelectedKeys;
    }
    return ['*'];
  }, [scopeKind, skeleton, selectedTerritoryNums, selectedWeekDates, initialSelectedKeys]);

  const resolvedTitle = useMemo(() => {
    if (initialTitle) return initialTitle;
    if (scopeKind === 'territories' && selectedTerritoryNums.length > 0) {
      return `Territórios ${selectedTerritoryNums.join(', ')}`;
    }
    if (scopeKind === 'weeks' && selectedWeekDates.length > 0) {
      return `Programação (${selectedWeekDates.join(', ')})`;
    }
    return eventTitle;
  }, [initialTitle, scopeKind, selectedTerritoryNums, selectedWeekDates, eventTitle]);

  const handleGenerateCapabilityLink = async () => {
    if (resolvedKeys.length === 0) {
      setFeedbackBanner('Selecione ao menos 1 item para compartilhar.');
      return;
    }
    setIsGenerating(true);
    setFeedbackBanner(null);
    try {
      const baseUrl =
        Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://sekundo.app';

      const artifacts = await createCapabilityLink({
        baseUrl,
        source: {
          eventId,
          title: resolvedTitle,
          skeleton: skeleton || [],
        },
        scope: {
          kind: scopeKind,
          engine: scopeKind === 'territories' ? 'territory' : scopeKind === 'weeks' ? 'schedule' : 'full',
          keys: resolvedKeys,
          mode: accessMode,
          includeNotes,
          title: resolvedTitle,
          eventId,
        },
      });

      // Always store in local cache for instant local / offline opening
      saveCapabilityBlobToLocalCache(artifacts.blobId, artifacts.cipherBlob);

      // Push encrypted blob to stateless Zero-Knowledge relay
      try {
        const res = await fetch(API.share.blob(artifacts.blobId), {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            cipher_blob: artifacts.cipherBlob,
            ttl_seconds: 7 * 24 * 3600,
          }),
        });
        setRelayStatus(res.ok ? 'uploaded' : 'local_only');
      } catch {
        setRelayStatus('local_only');
      }

      setGeneratedLink(artifacts);
    } catch (err: any) {
      setFeedbackBanner(err?.message || 'Erro ao gerar link de capacidade.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(generatedLink.url);
        setFeedbackBanner('Link copiado para a área de transferência!');
      }
    } catch {
      setFeedbackBanner('Copie o link exibido abaixo.');
    }
  };

  const handleShareNativeOrWhatsApp = async () => {
    if (!generatedLink) return;
    const modeLabel =
      accessMode === 'edit' ? '✏️ Pode marcar progresso' : '👁️ Somente leitura';
    const message = [
      `🗺️ *${resolvedTitle}* (${modeLabel})`,
      `Acesse direto sem precisar de cadastro ou senha:`,
      generatedLink.url,
    ].join('\n');

    await shareLocationPayload({
      title: resolvedTitle,
      text: message,
      mapsUrl: '',
      whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
    });
    setFeedbackBanner('Compartilhamento acionado!');
  };

  const handleOpenPreview = () => {
    if (!generatedLink) return;
    onClose();
    const hashIdx = generatedLink.url.indexOf('#');
    const hash = hashIdx >= 0 ? generatedLink.url.slice(hashIdx) : '';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.hash = hash;
    }
    router.push(`/s/${generatedLink.blobId}${hash}` as any);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="quick-share-sheet">
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>🔗 Compartilhar Escopo Rápido</Text>
              <Text style={styles.subtitle}>
                Link curto (&le; 200 caracteres) • Abre direto sem login • Criptografia no #fragmento
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              testID="quick-share-close-btn"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Scope Kind Selector */}
            <Text style={styles.sectionLabel}>1. O que você quer enviar?</Text>
            <View style={styles.pillRow}>
              <TouchableOpacity
                style={[
                  styles.modePill,
                  scopeKind === 'territories' && styles.modePillActive,
                ]}
                onPress={() => {
                  setScopeKind('territories');
                  setGeneratedLink(null);
                }}
                testID="quick-share-kind-territories"
              >
                <Text
                  style={[
                    styles.modePillText,
                    scopeKind === 'territories' && styles.modePillTextActive,
                  ]}
                >
                  🗺️ Territórios ({selectedTerritoryNums.length})
                </Text>
              </TouchableOpacity>

              {availableWeeks.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.modePill,
                    scopeKind === 'weeks' && styles.modePillActive,
                  ]}
                  onPress={() => {
                    setScopeKind('weeks');
                    setGeneratedLink(null);
                  }}
                  testID="quick-share-kind-weeks"
                >
                  <Text
                    style={[
                      styles.modePillText,
                      scopeKind === 'weeks' && styles.modePillTextActive,
                    ]}
                  >
                    📅 Semanas ({selectedWeekDates.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Multi-Territory Chips */}
            {scopeKind === 'territories' && territorySummaries.length > 0 && (
              <View style={styles.chipsBox}>
                <View style={styles.chipsHeaderRow}>
                  <Text style={styles.helperText}>
                    Toque nos territórios que deseja incluir no mesmo link (os demais ficam ocultos):
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setGeneratedLink(null);
                      if (selectedTerritoryNums.length === territorySummaries.length) {
                        setSelectedTerritoryNums([territorySummaries[0].territoryNumber]);
                      } else {
                        setSelectedTerritoryNums(
                          territorySummaries.map((t) => t.territoryNumber)
                        );
                      }
                    }}
                  >
                    <Text style={styles.selectAllLink}>
                      {selectedTerritoryNums.length === territorySummaries.length
                        ? 'Apenas 1º'
                        : 'Todos'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.chipsWrap}>
                  {territorySummaries.map((t) => {
                    const isSelected = selectedTerritoryNums.includes(t.territoryNumber);
                    return (
                      <TouchableOpacity
                        key={t.territoryNumber}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => toggleTerritoryNum(t.territoryNumber)}
                        testID={`quick-share-terr-chip-${t.territoryNumber}`}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextSelected,
                          ]}
                        >
                          {isSelected ? '✓ ' : ''}T-{t.territoryNumber}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Multi-Week Chips */}
            {scopeKind === 'weeks' && availableWeeks.length > 0 && (
              <View style={styles.chipsBox}>
                <Text style={styles.helperText}>
                  Selecione as semanas que deseja incluir no link:
                </Text>
                <View style={styles.chipsWrap}>
                  {availableWeeks.map((weekIso) => {
                    const isSelected = selectedWeekDates.includes(weekIso);
                    return (
                      <TouchableOpacity
                        key={weekIso}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => toggleWeekDate(weekIso)}
                        testID={`quick-share-week-chip-${weekIso}`}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextSelected,
                          ]}
                        >
                          {isSelected ? '✓ ' : ''}{weekIso}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Access Mode Selector */}
            <Text style={styles.sectionLabel}>2. Permissão do Link</Text>
            <View style={styles.pillRow}>
              <TouchableOpacity
                style={[
                  styles.modePill,
                  accessMode === 'read' && styles.modePillActive,
                ]}
                onPress={() => {
                  setAccessMode('read');
                  setGeneratedLink(null);
                }}
                testID="quick-share-mode-read"
              >
                <Text
                  style={[
                    styles.modePillText,
                    accessMode === 'read' && styles.modePillTextActive,
                  ]}
                >
                  👁️ Só ver (Leitura)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modePill,
                  accessMode === 'edit' && styles.modePillActiveEdit,
                ]}
                onPress={() => {
                  setAccessMode('edit');
                  setGeneratedLink(null);
                }}
                testID="quick-share-mode-edit"
              >
                <Text
                  style={[
                    styles.modePillText,
                    accessMode === 'edit' && styles.modePillTextActive,
                  ]}
                >
                  ✏️ Pode marcar progresso
                </Text>
              </TouchableOpacity>
            </View>

            {/* Opt-In Notes Toggle (SEC-06) */}
            <TouchableOpacity
              style={styles.optInRow}
              onPress={() => {
                setIncludeNotes((prev) => !prev);
                setGeneratedLink(null);
              }}
              testID="quick-share-include-notes-toggle"
            >
              <View style={[styles.checkbox, includeNotes && styles.checkboxChecked]}>
                {includeNotes && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optInTitle}>Incluir observações nas unidades</Text>
                <Text style={styles.optInSub}>
                  Desmarcado por padrão para proteger anotações privadas de moradores.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Generate Link Button */}
            {!generatedLink ? (
              <TouchableOpacity
                style={styles.generateBtn}
                onPress={handleGenerateCapabilityLink}
                disabled={isGenerating}
                testID="quick-share-generate-btn"
              >
                {isGenerating ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.generateBtnText}>
                    ⚡ Gerar Link Direto ({resolvedTitle})
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.resultBox} testID="quick-share-result-box">
                <View style={styles.resultHeader}>
                  <Text style={styles.resultBadge}>
                    ✅ {generatedLink. signedProjection.nodes.length} itens no escopo •{' '}
                    {generatedLink.url.length} caracteres
                  </Text>
                  <Text style={styles.relayBadge}>
                    {relayStatus === 'uploaded' ? '☁️ Relay E2EE Ativo (7d)' : '💾 Cache Local'}
                  </Text>
                </View>

                <Text selectable style={styles.urlText} testID="quick-share-url-text">
                  {generatedLink.url}
                </Text>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.primaryActionBtn}
                    onPress={handleShareNativeOrWhatsApp}
                    testID="quick-share-send-btn"
                  >
                    <Text style={styles.primaryActionBtnText}>📲 Enviar Link</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    onPress={handleCopyLink}
                    testID="quick-share-copy-btn"
                  >
                    <Text style={styles.secondaryActionBtnText}>📋 Copiar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    onPress={handleOpenPreview}
                    testID="quick-share-preview-btn"
                  >
                    <Text style={styles.secondaryActionBtnText}>🔎 Abrir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {feedbackBanner && (
              <Text style={styles.feedbackText}>{feedbackBanner}</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#334155',
    padding: Spacing.lg,
    maxHeight: '88%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  scrollArea: {
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  modePill: {
    flex: 1,
    minWidth: 140,
    minHeight: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  modePillActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
  },
  modePillActiveEdit: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  modePillText: {
    color: '#94A3B8',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  modePillTextActive: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  chipsBox: {
    backgroundColor: '#020617',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chipsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  helperText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: '#94A3B8',
  },
  selectAllLink: {
    fontSize: FontSize.xs,
    color: '#38BDF8',
    fontWeight: '700',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  chipText: {
    fontSize: FontSize.xs,
    color: '#94A3B8',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#34D399',
    fontWeight: '800',
  },
  optInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  checkboxMark: {
    color: '#020617',
    fontWeight: '900',
    fontSize: 14,
  },
  optInTitle: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  optInSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  generateBtn: {
    minHeight: 48,
    backgroundColor: '#10B981',
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  generateBtnText: {
    color: '#020617',
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  resultBox: {
    backgroundColor: '#020617',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#10B981',
    padding: Spacing.md,
    marginTop: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 6,
  },
  resultBadge: {
    fontSize: FontSize.xs,
    color: '#34D399',
    fontWeight: '700',
  },
  relayBadge: {
    fontSize: FontSize.xs,
    color: '#38BDF8',
    fontWeight: '600',
  },
  urlText: {
    fontSize: FontSize.xs,
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryActionBtn: {
    flex: 2,
    minWidth: 130,
    minHeight: 44,
    backgroundColor: '#10B981',
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryActionBtnText: {
    color: '#020617',
    fontWeight: '800',
    fontSize: FontSize.sm,
  },
  secondaryActionBtn: {
    flex: 1,
    minWidth: 85,
    minHeight: 44,
    backgroundColor: '#1E293B',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryActionBtnText: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: FontSize.sm,
  },
  feedbackText: {
    marginTop: 10,
    fontSize: FontSize.xs,
    color: '#38BDF8',
    textAlign: 'center',
    fontWeight: '600',
  },
});
