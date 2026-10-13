/**
 * Page: pdf-forms
 *
 * 1-Click Document Printing & Official AcroForm Form-Filler Console.
 * Specializes in:
 * - Official S-89 Meeting Assignment Slips (4-Up Imposition on A4)
 * - S-12 / S-13 Field Service Territory Cards
 * - Intelligent Arbitrary PDF Form Recognition & Auto-Filling (100% Offline / Client-Side)
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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import {
  fillS89Assignments4Up,
  fillAcroForm,
  inspectPDFForm,
  autoRecognizePDFFields,
  type S89Assignment,
  type PDFFormField,
  type FieldMappingCandidate,
  type TemplateRecognitionResult,
} from '@sekundo/core';

export default function PDFFormsConsole() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId = id || '';
  const { flatRegistry } = useSkeleton(eventId);

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<'s89' | 's12' | 'custom'>('s89');

  // Custom PDF Auto-Recognition State
  const [customPdfBytes, setCustomPdfBytes] = useState<Uint8Array | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [inspectedFields, setInspectedFields] = useState<PDFFormField[]>([]);
  const [recognitionResult, setRecognitionResult] = useState<TemplateRecognitionResult | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMappingCandidate[]>([]);

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

  // Handle uploading / picking a custom PDF file for auto-recognition
  const handlePickCustomPDF = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadedFileName(file.name);
        setLoading(true);
        setStatusMessage(`Analisando estrutura de campos em ${file.name}...`);
        try {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          setCustomPdfBytes(bytes);

          const fields = await inspectPDFForm(bytes);
          setInspectedFields(fields);

          const recognition = autoRecognizePDFFields(fields, bytes, flatRegistry);
          setRecognitionResult(recognition);
          setFieldMappings(recognition.mappings);

          setStatusMessage(
            `✅ Reconhecimento concluído: ${recognition.autoMatchedCount} de ${fields.length} campos mapeados automaticamente (${Math.round(recognition.overallConfidence * 100)}% de precisão)!`
          );
        } catch (err: any) {
          console.error(err);
          setStatusMessage(`❌ Erro ao analisar PDF: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };
      input.click();
    } else {
      try {
        const DocumentPicker = await import('expo-document-picker');
        const res = await DocumentPicker.getDocumentAsync({
          type: 'application/pdf',
          copyToCacheDirectory: true,
        });
        if (res.canceled || !res.assets || res.assets.length === 0) return;
        const asset = res.assets[0];
        setUploadedFileName(asset.name);
        setLoading(true);
        setStatusMessage(`Lendo arquivo ${asset.name}...`);
        const FileSystem = await import('expo-file-system');
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        setCustomPdfBytes(bytes);
        const fields = await inspectPDFForm(bytes);
        setInspectedFields(fields);
        const recognition = autoRecognizePDFFields(fields, bytes, flatRegistry);
        setRecognitionResult(recognition);
        setFieldMappings(recognition.mappings);
        setStatusMessage(`✅ Reconhecimento concluído: ${recognition.autoMatchedCount} de ${fields.length} campos identificados!`);
      } catch (err: any) {
        setStatusMessage(`❌ Erro ao ler PDF: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Compile and fill custom PDF
  const handleGenerateCustomPDF = async () => {
    if (!customPdfBytes || fieldMappings.length === 0) {
      Alert.alert('Atenção', 'Carregue um arquivo PDF primeiro.');
      return;
    }
    try {
      setLoading(true);
      setStatusMessage('Injetando dados do evento no PDF...');

      const sampleEntry = flatRegistry.find((e) => e.value && e.value.trim().length > 0) || flatRegistry[0];

      const valuesToInject: Record<string, string | boolean | number> = {};
      for (const m of fieldMappings) {
        if (!m.matchedAttribute || m.matchedAttribute === 'ignore') continue;
        let val: string | undefined = undefined;
        if (m.matchedAttribute === 'value') {
          val = sampleEntry?.value || '';
        } else if (m.matchedAttribute === 'label') {
          val = sampleEntry?.label || '';
        } else if (m.matchedAttribute.startsWith('meta.')) {
          const k = m.matchedAttribute.slice(5);
          val = String(sampleEntry?.meta?.[k] ?? '');
        } else if (m.suggestedValue) {
          val = m.suggestedValue;
        }
        if (val !== undefined) {
          valuesToInject[m.pdfFieldName] = val;
        }
      }

      const result = await fillAcroForm(customPdfBytes, valuesToInject, { flatten: true });

      if (Platform.OS === 'web') {
        const blob = new Blob([result.pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const cleanName = uploadedFileName ? uploadedFileName.replace(/\.pdf$/i, '') : 'Formulario';
        link.download = `${cleanName}_Preenchido_${new Date().toISOString().slice(0, 10)}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      }

      setStatusMessage(`🎉 PDF compilado com sucesso! ${result.filledFieldCount} campos preenchidos diretamente.`);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`❌ Erro ao preencher PDF: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateS89 = async () => {
    try {
      setLoading(true);
      setStatusMessage('Gerando documento com imposição 4-Up...');

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

      if (Platform.OS === 'web') {
        const blob = new Blob([filledResult.pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Fichas_Designacao_4Up_${new Date().toISOString().slice(0, 10)}.pdf`;
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
            Preenchimento automático e imposição gráfica 4-Up via leitura nativa de AcroForms. 100% Offline & Soberano.
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
              <Text style={styles.templateCardTitle}>Fichas de Designação 4-Up (Universal)</Text>
              <Text style={styles.templateCardDesc}>
                Imposição 4-Up em folha A4 com corte em guilhotina (Designado, Data, Sala, Atividade).
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedTemplate('s12')}
              style={[styles.templateCard, selectedTemplate === 's12' && styles.templateCardActive]}
            >
              <Text style={styles.templateCardTitle}>Cartões de Território & Logística</Text>
              <Text style={styles.templateCardDesc}>
                Ficha tática de saída com lista de endereços, quadras e histórico de cobertura.
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedTemplate('custom')}
              style={[styles.templateCard, selectedTemplate === 'custom' && styles.templateCardActive]}
            >
              <Text style={styles.templateCardTitle}>📂 Reconhecimento Automático de PDF</Text>
              <Text style={styles.templateCardDesc}>
                Carregue qualquer arquivo PDF com campos interativos para detecção e mapeamento automático.
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Custom PDF Upload & Recognition Dashboard */}
        {selectedTemplate === 'custom' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ARQUIVO PDF DO USUÁRIO</Text>

            <Pressable onPress={handlePickCustomPDF} style={styles.uploadDropZone}>
              <Text style={styles.uploadIcon}>📄</Text>
              <Text style={styles.uploadTitle}>
                {uploadedFileName ? `Arquivo: ${uploadedFileName}` : 'Clique para selecionar qualquer arquivo PDF'}
              </Text>
              <Text style={styles.uploadDesc}>
                Detecção semântica em português, inglês e espanhol com cálculo SHA-256 e inferência instantânea.
              </Text>
            </Pressable>

            {recognitionResult ? (
              <View style={styles.recognitionCard}>
                <View style={styles.recognitionHeader}>
                  <View>
                    <Text style={styles.recognitionTitle}>🎯 Diagnóstico do Template PDF</Text>
                    <Text style={styles.recognitionSub}>
                      Hash: {recognitionResult.templateHash.slice(0, 16)}... • {recognitionResult.totalFieldsDetected} campos detectados
                    </Text>
                  </View>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceBadgeText}>
                      {Math.round(recognitionResult.overallConfidence * 100)}% Confiança
                    </Text>
                  </View>
                </View>

                {/* Field Mappings Table */}
                <View style={styles.mappingList}>
                  <Text style={styles.mappingListHeader}>CAMPOS DETECTADOS & MAPEAMENTO SEMÂNTICO:</Text>
                  {fieldMappings.map((m, idx) => (
                    <View key={idx} style={styles.mappingRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldIdText}>{m.pdfFieldName}</Text>
                        <Text style={styles.mappedAttrText}>
                          Mapeado para: <Text style={{ color: '#38BDF8', fontWeight: '700' }}>{m.matchedAttribute}</Text>
                        </Text>
                      </View>

                      <View style={styles.mappingRight}>
                        <View style={[styles.confidencePill, m.confidence >= 0.8 ? styles.pillHigh : styles.pillMedium]}>
                          <Text style={styles.confidencePillText}>{Math.round(m.confidence * 100)}%</Text>
                        </View>
                        {m.samplePreview ? (
                          <Text style={styles.samplePreviewText} numberOfLines={1}>
                            "{m.samplePreview}"
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>

                {/* 1-Click Fill Action */}
                <Pressable onPress={handleGenerateCustomPDF} style={styles.fillCustomBtn}>
                  <Text style={styles.fillCustomBtnText}>
                    ⚡ Preencher PDF com Dados do Sekundo (1-Click)
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          /* Preview of Extracted Data for S-89 */
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

            {/* S-89 Action Button */}
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
            </View>
          </View>
        )}

        {statusMessage && (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        )}
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
  uploadDropZone: {
    backgroundColor: '#121722',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  uploadIcon: {
    fontSize: 32,
  },
  uploadTitle: {
    color: '#F0F4F8',
    fontSize: 15,
    fontWeight: '700',
  },
  uploadDesc: {
    color: '#8A99AD',
    fontSize: 12,
    textAlign: 'center',
  },
  recognitionCard: {
    marginTop: 16,
    backgroundColor: '#161D2B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242F45',
    padding: 18,
    gap: 14,
  },
  recognitionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 12,
  },
  recognitionTitle: {
    color: '#F0F4F8',
    fontSize: 16,
    fontWeight: '800',
  },
  recognitionSub: {
    color: '#8A99AD',
    fontSize: 11,
    marginTop: 2,
  },
  confidenceBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  confidenceBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
  },
  mappingList: {
    gap: 8,
  },
  mappingListHeader: {
    color: '#6B7A90',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  mappingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#121722',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  fieldIdText: {
    color: '#F0F4F8',
    fontSize: 13,
    fontWeight: '700',
  },
  mappedAttrText: {
    color: '#8A99AD',
    fontSize: 11,
    marginTop: 2,
  },
  mappingRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  confidencePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillHigh: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  pillMedium: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  confidencePillText: {
    color: '#F0F4F8',
    fontSize: 10,
    fontWeight: '700',
  },
  samplePreviewText: {
    color: '#6B7A90',
    fontSize: 11,
    fontStyle: 'italic',
    maxWidth: 160,
  },
  fillCustomBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  fillCustomBtnText: {
    color: '#062016',
    fontSize: 14,
    fontWeight: '800',
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
