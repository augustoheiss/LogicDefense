/**
 * Page: csv-import
 *
 * Imports CSV skeleton data.
 * Computes visual diffs showing additions, modifications, and deletions
 * before saving to localStorage.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import { useLocalEvent } from '../hooks/useLocalEvent';
import CSVDropZone from '../components/csv/CSVDropZone.web';
import { CSVPreviewTable } from '../components/csv/CSVPreviewTable';
import { buildDiff, validateCSV, upsertRegistry } from '@sekundo/core';
import type { CSVDiffResult, CSVRow, UpsertResult } from '@sekundo/core';

export default function CSVImport() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events } = useLocalEvent();
  const event = events.find((e) => e.config.id === eventId);

  const { flatRegistry, commitCSVImport, loading } = useSkeleton(eventId);

  const [parsedRows, setParsedRows] = useState<CSVRow[] | null>(null);
  const [diff, setDiff] = useState<CSVDiffResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preserveHistory, setPreserveHistory] = useState<boolean>(true);
  const [preservedCount, setPreservedCount] = useState<number>(0);

  if (loading || !event) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  const handleParsed = (rows: CSVRow[]) => {
    // 1. Validate rows first
    const validationResult = validateCSV(rows);
    if (!validationResult.valid) {
      // Build a detailed error summary
      const detailedErrors = validationResult.errors
        .map((e) => `Row ${e.row} (${e.key}): ${e.errors.join(', ')}`)
        .join('\n');
      setErrorMessage(`Validation Failed:\n${detailedErrors}`);
      return;
    }

    // 2. Compute upsert and diff
    const computedDiff = buildDiff(flatRegistry, rows);
    const upsertRes = upsertRegistry(flatRegistry, rows, {
      forceOverwriteState: !preserveHistory,
    });
    setPreservedCount(upsertRes.diff.preservedHistoryCount);
    setParsedRows(rows);
    setDiff(computedDiff);
    setErrorMessage(null);
  };

  const togglePreserveHistory = () => {
    const nextVal = !preserveHistory;
    setPreserveHistory(nextVal);
    if (parsedRows) {
      const upsertRes = upsertRegistry(flatRegistry, parsedRows, {
        forceOverwriteState: !nextVal,
      });
      setPreservedCount(upsertRes.diff.preservedHistoryCount);
    }
  };

  const handleCommit = async () => {
    if (!parsedRows) return;
    await commitCSVImport(parsedRows, {
      forceOverwriteState: !preserveHistory,
    });
    router.replace(`/skeleton-editor?id=${eventId}`);
  };

  const handleReset = () => {
    setParsedRows(null);
    setDiff(null);
    setErrorMessage(null);
    setPreservedCount(0);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>CSV Import & Preview</Text>
          <Text style={styles.subtitle}>
            Event: {event.config.name} ({event.config.frequency.toUpperCase()})
          </Text>
        </View>

        {/* Error Message */}
        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Validation Error</Text>
            <ScrollView style={styles.errorScroll}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </ScrollView>
            <Pressable onPress={handleReset} style={styles.errorDismissBtn}>
              <Text style={styles.errorDismissText}>Try Again</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Action Panel */}
        {!parsedRows && !errorMessage ? (
          <View style={styles.uploadArea}>
            <CSVDropZone onParsed={handleParsed} onError={setErrorMessage} />
            <Text style={styles.uploadSub}>
              Ensure your CSV follows the standard schema requirements (`_key`, `_type`, `label`).
            </Text>
          </View>
        ) : null}

        {/* Preview and Diff area */}
        {parsedRows && diff && !errorMessage ? (
          <View style={styles.previewArea}>
            <Text style={styles.previewTitle}>Prévia de Mesclagem & Resolução</Text>
            <Text style={styles.previewSub}>
              Revise as alterações antes de confirmar. O Sekundo compara os códigos hierárquicos e atualiza seu evento.
            </Text>

            {/* Smart History Preservation Toggle */}
            <Pressable
              onPress={togglePreserveHistory}
              style={[
                styles.preserveBanner,
                preserveHistory ? styles.preserveBannerActive : styles.preserveBannerInactive,
              ]}
            >
              <Text style={styles.preserveBannerIcon}>{preserveHistory ? '🛡️' : '⚠️'}</Text>
              <View style={styles.preserveBannerInfo}>
                <Text style={styles.preserveBannerTitle}>
                  {preserveHistory
                    ? 'Proteção Inteligente de Histórico Ativa (Recomendado)'
                    : 'Atenção: Sobrescrever Histórico Totalmente'}
                </Text>
                <Text style={styles.preserveBannerDesc}>
                  {preserveHistory
                    ? `Mantém intactos registros de visitas anteriores, datas e anotações locais (${preservedCount} itens protegidos).`
                    : 'Todas as marcações de trabalho locais serão limpas ou substituídas pelos dados brutos do arquivo.'}
                </Text>
              </View>
              <View
                style={[
                  styles.preserveBadge,
                  preserveHistory ? styles.preserveBadgeActive : styles.preserveBadgeInactive,
                ]}
              >
                <Text style={styles.preserveBadgeText}>{preserveHistory ? 'ATIVO' : 'DESLIGADO'}</Text>
              </View>
            </Pressable>

            <View style={styles.previewWrapper}>
              <CSVPreviewTable diff={diff} preservedHistoryCount={preservedCount} />
            </View>

            {/* Commit controls */}
            <View style={styles.controlsRow}>
              <Pressable onPress={handleReset} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Descartar</Text>
              </Pressable>
              <Pressable
                onPress={handleCommit}
                style={[
                  styles.commitBtn,
                  preserveHistory ? styles.commitBtnPreserve : styles.commitBtnOverwrite,
                ]}
              >
                <Text style={styles.commitBtnText}>
                  {preserveHistory
                    ? '✓ Mesclar (Protegendo Histórico)'
                    : '⚠️ Sobrescrever Tudo'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 900,
    height: '100%',
    maxHeight: 700,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: '#8A94A6',
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6F7E94',
    fontSize: 13,
    marginTop: 4,
  },
  uploadArea: {
    flex: 1,
    justifyContent: 'center',
  },
  uploadSub: {
    color: '#4F5E74',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  errorCard: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  errorScroll: {
    flex: 1,
    marginBottom: 16,
  },
  errorText: {
    color: '#D1D5DB',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  errorDismissBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  errorDismissText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  previewArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  previewSub: {
    color: '#8A94A6',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
    marginBottom: 16,
  },
  previewWrapper: {
    flex: 1,
    marginBottom: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 12,
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#A9B4C5',
    fontSize: 14,
    fontWeight: '600',
  },
  commitBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  commitBtnPreserve: {
    backgroundColor: '#10B981',
  },
  commitBtnOverwrite: {
    backgroundColor: '#F59E0B',
  },
  commitBtnText: {
    color: '#062016',
    fontWeight: '700',
    fontSize: 14,
  },
  preserveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  preserveBannerActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  preserveBannerInactive: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  preserveBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  preserveBannerInfo: {
    flex: 1,
    paddingRight: 10,
  },
  preserveBannerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  preserveBannerDesc: {
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 16,
  },
  preserveBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  preserveBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  preserveBadgeInactive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  preserveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
