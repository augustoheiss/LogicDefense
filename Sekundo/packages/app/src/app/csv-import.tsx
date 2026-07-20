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
import { buildDiff, validateCSV } from '@sekundo/core';
import type { CSVDiffResult, CSVRow } from '@sekundo/core';

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

    // 2. Compute diff
    const computedDiff = buildDiff(flatRegistry, rows);
    setParsedRows(rows);
    setDiff(computedDiff);
    setErrorMessage(null);
  };

  const handleCommit = async () => {
    if (!parsedRows) return;
    await commitCSVImport(parsedRows);
    router.replace(`/skeleton-editor?id=${eventId}`);
  };

  const handleReset = () => {
    setParsedRows(null);
    setDiff(null);
    setErrorMessage(null);
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
            <Text style={styles.previewTitle}>Conflict Resolution Diff Preview</Text>
            <Text style={styles.previewSub}>
              Review the differences below before confirming. Last import wins (will overwrite your current skeleton configuration).
            </Text>

            <View style={styles.previewWrapper}>
              <CSVPreviewTable diff={diff} />
            </View>

            {/* Commit controls */}
            <View style={styles.controlsRow}>
              <Pressable onPress={handleReset} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Discard Changes</Text>
              </Pressable>
              <Pressable onPress={handleCommit} style={styles.commitBtn}>
                <Text style={styles.commitBtnText}>Apply & Overwrite</Text>
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
    backgroundColor: '#FFB800',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  commitBtnText: {
    color: '#12151C',
    fontWeight: '700',
    fontSize: 14,
  },
});
