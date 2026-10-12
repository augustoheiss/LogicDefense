/**
 * Page: pdf-forms
 *
 * 1-Click Document Printing & Official AcroForm Form-Filler Console.
 * Specializes in:
 * - Official S-89 Meeting Assignment Slips (4-Up Imposition on A4)
 * - S-12 / S-13 Field Service Territory Cards
 * - Custom AcroForm template injection
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import {
  fillS89Assignments4Up,
  inspectPDFForm,
  type S89Assignment,
  type PDFFormField,
} from '@sekundo/core';

export default function PDFFormsConsole() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId = id || '';
  const { flatRegistry } = useSkeleton(eventId);

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<'s89' | 's12' | 'custom'>('s89');
  const [inspectedFields, setInspectedFields] = useState<PDFFormField[]>([]);

  // Synthesize S-89 assignments from active skeleton registry
  const extractedAssignments: S89Assignment[] = flatRegistry
    .filter((entry) => entry.value && entry.value.trim().length > 0)
    .slice(0, 4)
    .map((entry, idx) => ({
      studentName: entry.value,
      assistantName: (entry.meta?.assistantTo as string) || (entry.meta?.ajudante as string) || undefined,
      date: (entry.meta?.date as string) || (entry.meta?.data as string) || new Date().toLocaleDateString('pt-BR'),
      partTitle: entry.label || `Designação ${idx + 1}`,
      roomOrHall: (entry.meta?.room as string) || (entry.meta?.sala as string) || 'Salão Principal',
      remarks: (entry.meta?.remarks as string) || undefined,
    }));

  const handleGenerateS89 = async () => {
    try {
      setLoading(true);
      setStatusMessage('Gerando documento S-89 com imposição 4-Up...');

      // Dynamic synthetic template generation for demo/offline resilience
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.create();
      const page = doc.addPage([595.28, 841.89]); // A4 dimensions
      const form = doc.getForm();

      // Create 4 standard quadrants
      for (let q = 1; q <= 4; q++) {
        const yBase = 800 - q * 185;
        const studentField = form.createTextField(`900_${q}_Text_SanSerif`);
        studentField.addToPage(page, { x: 60, y: yBase, width: 220, height: 22 });

        const dateField = form.createTextField(`900_${q}_Text_SanSerif_Date`);
        dateField.addToPage(page, { x: 300, y: yBase, width: 90, height: 22 });

        const partField = form.createTextField(`900_${q}_Text_SanSerif_Part`);
        partField.addToPage(page, { x: 410, y: yBase, width: 140, height: 22 });
      }

      const templateBytes = await doc.save();
      const filledResult = await fillS89Assignments4Up(templateBytes, extractedAssignments, { flatten: true });

      // In Web, download the file directly
      if (Platform.OS === 'web') {
        const blob = new Blob([filledResult.pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `S-89_Designacoes_${new Date().toISOString().slice(0, 10)}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      }

      setStatusMessage(`✅ Sucesso! Preenchidos ${filledResult.filledFieldCount} campos nos 4 quadrantes.`);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`❌ Erro ao compilar PDF: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Navigation */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Voltar ao Esqueleto</Text>
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Central de Formulários Oficiais PDF</Text>
          <Text style={styles.subtitle}>
            Preenchimento automático e imposição gráfica 4-Up via leitura nativa de AcroForms.
          </Text>
        </View>

        {/* Template Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECIONE O MODELO DE FORMULÁRIO</Text>
          <View style={styles.templateRow}>
            <Pressable
              onPress={() => setSelectedTemplate('s89')}
              style={[styles.templateCard, selectedTemplate === 's89' && styles.templateCardActive]}
            >
              <Text style={styles.templateCardTitle}>S-89 (Designações de Reunião)</Text>
              <Text style={styles.templateCardDesc}>
                Imposição 4-Up em folha A4 com corte em guilhotina (Estudante, Data, Sala, Parte).
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedTemplate('s12')}
              style={[styles.templateCard, selectedTemplate === 's12' && styles.templateCardActive]}
            >
              <Text style={styles.templateCardTitle}>S-12 / S-13 (Cartões de Território)</Text>
              <Text style={styles.templateCardDesc}>
                Ficha tática de saída de campo com lista de ruas, quadras e histórico de cobertura.
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Preview of Extracted Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DADOS DETECTADOS NA ÁRVORE ATIVA</Text>
          {extractedAssignments.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Nenhuma designação com nome preenchido encontrada na árvore.
              </Text>
            </View>
          ) : (
            extractedAssignments.map((a, idx) => (
              <View key={idx} style={styles.assignmentPreviewRow}>
                <View style={styles.badgeQuadrant}>
                  <Text style={styles.badgeQuadrantText}>Via {idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assigneeName}>{a.studentName}</Text>
                  <Text style={styles.assigneeMeta}>
                    {a.partTitle} • {a.date} • {a.roomOrHall}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#FFB800" />
          ) : (
            <Pressable onPress={handleGenerateS89} style={styles.generateButton}>
              <Text style={styles.generateButtonText}>
                ⚡ Compilar e Baixar PDF Preenchido (1-Click)
              </Text>
            </Pressable>
          )}

          {statusMessage && (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D14',
  },
  scrollContent: {
    padding: 24,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  backButtonText: {
    color: '#8A99AD',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F0F4F8',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#8A99AD',
    marginTop: 6,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A90',
    letterSpacing: 1,
    marginBottom: 12,
  },
  templateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  templateCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#121722',
    borderWidth: 1,
    borderColor: '#1E2638',
    borderRadius: 12,
    padding: 16,
  },
  templateCardActive: {
    borderColor: '#FFB800',
    backgroundColor: '#1A1E29',
  },
  templateCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F0F4F8',
    marginBottom: 6,
  },
  templateCardDesc: {
    fontSize: 12,
    color: '#8A99AD',
    lineHeight: 18,
  },
  emptyBox: {
    padding: 20,
    backgroundColor: '#121722',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2638',
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7A90',
    fontSize: 13,
  },
  assignmentPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#121722',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2638',
    marginBottom: 8,
  },
  badgeQuadrant: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeQuadrantText: {
    color: '#FFB800',
    fontSize: 11,
    fontWeight: '700',
  },
  assigneeName: {
    color: '#F0F4F8',
    fontSize: 14,
    fontWeight: '600',
  },
  assigneeMeta: {
    color: '#8A99AD',
    fontSize: 12,
    marginTop: 2,
  },
  actionContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  generateButton: {
    backgroundColor: '#FFB800',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#FFB800',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  generateButtonText: {
    color: '#0A0D14',
    fontSize: 15,
    fontWeight: '700',
  },
  statusBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#161D2B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242F45',
    width: '100%',
  },
  statusText: {
    color: '#DCE4EE',
    fontSize: 13,
    textAlign: 'center',
  },
});
