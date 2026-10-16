/**
 * Page: pdf-forms
 *
 * 1-Click Document Printing & Official AcroForm Form-Filler Console.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSkeleton } from '../hooks/useSkeleton';
import {
  fillS89Assignments4Up,
  fillAcroForm,
  fillAcroFormMailMerge,
  stampCoordinateMapOnPDF,
  inspectPDFForm,
  autoRecognizePDFFields,
  computeTemplateFingerprintSha256,
  generateTerritoryS13AndCardsPDF,
  computeTerritoryRecencyList,
  buildTerritoriosS13HistoricalRegistry,
  PROGRAMACAO_UNIT_NAME,
  type S89Assignment,
  type FieldMappingCandidate,
  type TemplateRecognitionResult,
} from '@sekundo/core';
import { deliverFile } from '../utils/deliverFile';
import { loadPDFMap } from '../storage/localStorage';
import {
  CustomPdfSection,
  TerritoryS13Section,
  S89AssignmentsSection,
} from '../components/forms/PdfFormsSections';

export default function PDFFormsConsole() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId = id || '';
  const { flatRegistry } = useSkeleton(eventId);

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<'s89' | 's12' | 'custom'>('custom');
  const [s13ServiceYear, setS13ServiceYear] = useState<'all' | '2027' | '2026'>('all');
  const [mailMergeAllRecords, setMailMergeAllRecords] = useState<boolean>(false);

  const [customPdfBytes, setCustomPdfBytes] = useState<Uint8Array | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [recognitionResult, setRecognitionResult] = useState<TemplateRecognitionResult | null>(
    null
  );
  const [fieldMappings, setFieldMappings] = useState<FieldMappingCandidate[]>([]);

  const extractedAssignments: S89Assignment[] = flatRegistry
    .filter((entry) => entry.value && entry.value.trim().length > 0)
    .slice(0, 4)
    .map((entry, idx) => ({
      studentName: entry.value,
      assistantName:
        (entry.meta?.assistantTo as string) || (entry.meta?.ajudante as string) || undefined,
      date:
        (entry.meta?.date as string) ||
        (entry.meta?.data as string) ||
        new Date().toLocaleDateString('pt-BR'),
      partTitle: entry.label || `Designação ${idx + 1}`,
      roomOrHall:
        (entry.meta?.room as string) || (entry.meta?.sala as string) || 'Auditório Principal',
      remarks: (entry.meta?.remarks as string) || undefined,
    }));

  const effectiveTerritoryRegistry = flatRegistry.some((e) => e.type === 'territory')
    ? flatRegistry
    : buildTerritoriosS13HistoricalRegistry();

  const territoryRecencySummary = computeTerritoryRecencyList(
    effectiveTerritoryRegistry,
    'hierarchical'
  );

  const handleGenerateS13AndCards = async () => {
    try {
      setLoading(true);
      setStatusMessage(
        `Gerando Registro Multi-Ciclo (4 Colunas — Ciclo ${s13ServiceYear}) e Cartões de Quadra (100% local)...`
      );
      const res = await generateTerritoryS13AndCardsPDF(effectiveTerritoryRegistry, {
        eventName: eventId ? `Territórios (${eventId})` : PROGRAMACAO_UNIT_NAME,
        serviceYear: s13ServiceYear,
        includeQuadraCards: true,
      });

      const filename = `Registro_Territorios_${s13ServiceYear}_e_Cartoes_${new Date().toISOString().slice(0, 10)}.pdf`;
      await deliverFile(res.pdfBytes, filename, 'application/pdf');
      setStatusMessage(
        `✅ PDF Registro (4 Colunas) + Cartões gerado com sucesso! ${res.territoryCount} territórios, ${res.quadraCount} quadras (${res.workedUnits}/${res.totalUnits} unidades concluídas).`
      );
    } catch (err: any) {
      setStatusMessage(`❌ Erro ao gerar PDF de Territórios: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const inspectAndRecognizeBytes = async (bytes: Uint8Array, name: string) => {
    setUploadedFileName(name);
    setCustomPdfBytes(bytes);
    const fields = await inspectPDFForm(bytes);
    const sha256Hash = await computeTemplateFingerprintSha256(bytes);
    const recognition = autoRecognizePDFFields(fields, bytes, flatRegistry);
    recognition.templateHash = sha256Hash;
    setRecognitionResult(recognition);
    setFieldMappings(recognition.mappings);
    setStatusMessage(
      `✅ Reconhecimento concluído: ${recognition.autoMatchedCount} de ${fields.length} campos mapeados automaticamente (${Math.round(recognition.overallConfidence * 100)}% de precisão)!`
    );
  };

  const handlePickCustomPDF = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        setStatusMessage(`Analisando estrutura de campos em ${file.name}...`);
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          await inspectAndRecognizeBytes(bytes, file.name);
        } catch (err: any) {
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
        if (res.canceled || !res.assets?.[0]) return;
        const asset = res.assets[0];
        setLoading(true);
        setStatusMessage(`Lendo arquivo ${asset.name}...`);
        const { File: ExpoFile } = await import('expo-file-system');
        const rawBytes = await new ExpoFile(asset.uri).bytes();
        const bytes = new Uint8Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
        await inspectAndRecognizeBytes(bytes, asset.name);
      } catch (err: any) {
        setStatusMessage(`❌ Erro ao ler PDF: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGenerateCustomPDF = async () => {
    if (!customPdfBytes) {
      Alert.alert('Atenção', 'Carregue um arquivo PDF primeiro.');
      return;
    }
    try {
      setLoading(true);
      setStatusMessage('Injetando dados do evento no PDF...');
      const sha256Hash = await computeTemplateFingerprintSha256(customPdfBytes);
      const savedCoordMap = await loadPDFMap(sha256Hash);
      const nonEmptyEntries = flatRegistry.filter((e) => e.value && e.value.trim().length > 0);
      const targetEntries = mailMergeAllRecords
        ? nonEmptyEntries.length > 0
          ? nonEmptyEntries
          : flatRegistry.slice(0, 1)
        : [nonEmptyEntries[0] || flatRegistry[0]].filter(Boolean);

      let outputPdfBytes: Uint8Array;
      let filledCount = 0;

      if (fieldMappings.length > 0) {
        const records = targetEntries.map((sampleEntry) => {
          const valuesToInject: Record<string, string | boolean | number> = {};
          for (const m of fieldMappings) {
            if (!m.matchedAttribute || m.matchedAttribute === 'ignore') continue;
            let val: string | undefined;
            if (m.matchedAttribute === 'value') val = sampleEntry?.value || '';
            else if (m.matchedAttribute === 'label') val = sampleEntry?.label || '';
            else if (m.matchedAttribute.startsWith('meta.')) {
              val = String(sampleEntry?.meta?.[m.matchedAttribute.slice(5)] ?? '');
            } else if (m.suggestedValue) val = m.suggestedValue;
            if (val !== undefined) valuesToInject[m.pdfFieldName] = val;
          }
          return valuesToInject;
        });

        const result = mailMergeAllRecords
          ? await fillAcroFormMailMerge(customPdfBytes, records)
          : await fillAcroForm(customPdfBytes, records[0] || {}, { flatten: true });
        outputPdfBytes = result.pdfBytes;
        filledCount = result.filledFieldCount;
      } else if (savedCoordMap) {
        const stamped = await stampCoordinateMapOnPDF(customPdfBytes, savedCoordMap, flatRegistry);
        outputPdfBytes = stamped.pdfBytes;
        filledCount = stamped.stampedCount;
      } else {
        outputPdfBytes = customPdfBytes;
      }

      const cleanName = uploadedFileName ? uploadedFileName.replace(/\.pdf$/i, '') : 'Formulario';
      await deliverFile(
        outputPdfBytes,
        `${cleanName}_Preenchido_${new Date().toISOString().slice(0, 10)}.pdf`,
        'application/pdf'
      );
      setStatusMessage(
        `🎉 PDF compilado com sucesso! ${filledCount} campos preenchidos (${targetEntries.length} registro(s)).`
      );
    } catch (err: any) {
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
      const page = doc.addPage([595.28, 841.89]);
      const form = doc.getForm();
      for (let q = 1; q <= 4; q++) {
        const yBase = 800 - q * 185;
        form
          .createTextField(`900_${q}_Text_SanSerif`)
          .addToPage(page, { x: 60, y: yBase, width: 220, height: 22 });
        form
          .createTextField(`900_${q}_Text_SanSerif_Date`)
          .addToPage(page, { x: 300, y: yBase, width: 90, height: 22 });
        form
          .createTextField(`900_${q}_Text_SanSerif_Part`)
          .addToPage(page, { x: 410, y: yBase, width: 140, height: 22 });
      }
      const templateBytes = await doc.save();
      const filledResult = await fillS89Assignments4Up(templateBytes, extractedAssignments, {
        flatten: true,
      });
      await deliverFile(
        filledResult.pdfBytes,
        `Fichas_Designacao_4Up_${new Date().toISOString().slice(0, 10)}.pdf`,
        'application/pdf'
      );
      setStatusMessage(
        `✅ Sucesso! Preenchidos ${filledResult.filledFieldCount} campos nos 4 quadrantes.`
      );
    } catch (err: any) {
      setStatusMessage(`❌ Erro ao compilar PDF: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Voltar ao Esqueleto</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/studio?id=${eventId}` as any)}
            style={styles.studioBtn}
          >
            <Text style={styles.studioBtnText}>🖋️ Abrir Estúdio Documental YAML ⇄ PDF</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Central de Formulários Oficiais PDF</Text>
          <Text style={styles.subtitle}>
            Preenchimento automático, Mala Direta e imposição gráfica 4-Up via leitura nativa de AcroForms. 100% Offline & Soberano.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECIONE O MODELO DE FORMULÁRIO</Text>
          <View style={styles.templateRow}>
            {(
              [
                [
                  's89',
                  'Fichas de Designação 4-Up (Universal)',
                  'Imposição 4-Up em folha A4 com corte em guilhotina (Designado, Data, Sala, Atividade).',
                ],
                [
                  's12',
                  'Registro Multi-Ciclo & Cartões de Território',
                  'Tabela de designação/conclusão de territórios (4 Colunas) + fichas táticas de quadras.',
                ],
                [
                  'custom',
                  '📂 Reconhecimento Automático de PDF',
                  'Carregue qualquer arquivo PDF com campos interativos para detecção e mapeamento automático.',
                ],
              ] as const
            ).map(([key, title, desc]) => (
              <Pressable
                key={key}
                onPress={() => setSelectedTemplate(key)}
                style={[styles.templateCard, selectedTemplate === key && styles.templateCardActive]}
              >
                <Text style={styles.templateCardTitle}>{title}</Text>
                <Text style={styles.templateCardDesc}>{desc}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {selectedTemplate === 'custom' ? (
          <CustomPdfSection
            uploadedFileName={uploadedFileName}
            recognitionResult={recognitionResult}
            fieldMappings={fieldMappings}
            mailMergeAllRecords={mailMergeAllRecords}
            onSetMailMergeAllRecords={setMailMergeAllRecords}
            onPickCustomPDF={handlePickCustomPDF}
            onGenerateCustomPDF={handleGenerateCustomPDF}
          />
        ) : selectedTemplate === 's12' ? (
          <TerritoryS13Section
            s13ServiceYear={s13ServiceYear}
            onSetS13ServiceYear={setS13ServiceYear}
            territoryRecencySummary={territoryRecencySummary}
            loading={loading}
            onGenerateS13AndCards={handleGenerateS13AndCards}
          />
        ) : (
          <S89AssignmentsSection
            extractedAssignments={extractedAssignments}
            loading={loading}
            onGenerateS89={handleGenerateS89}
          />
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
  container: { flex: 1, backgroundColor: '#0A0D14' },
  scrollContent: { padding: 24, maxWidth: 900, alignSelf: 'center', width: '100%' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  backButton: { paddingVertical: 8 },
  backButtonText: { color: '#8A99AD', fontSize: 14, fontWeight: '600' },
  studioBtn: { backgroundColor: 'rgba(139, 92, 246, 0.18)', borderWidth: 1, borderColor: '#8B5CF6', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  studioBtnText: { color: '#C4B5FD', fontSize: 13, fontWeight: '700' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#F0F4F8', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#8A99AD', marginTop: 6, lineHeight: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6B7A90', letterSpacing: 1, marginBottom: 12 },
  templateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  templateCard: { flex: 1, minWidth: 260, backgroundColor: '#121722', borderWidth: 1, borderColor: '#1E2638', borderRadius: 12, padding: 16 },
  templateCardActive: { borderColor: '#FFB800', backgroundColor: '#1A1E29' },
  templateCardTitle: { fontSize: 15, fontWeight: '700', color: '#F0F4F8', marginBottom: 6 },
  templateCardDesc: { fontSize: 12, color: '#8A99AD', lineHeight: 18 },
  statusBox: { marginTop: 16, padding: 12, backgroundColor: '#161D2B', borderRadius: 8, borderWidth: 1, borderColor: '#242F45', width: '100%' },
  statusText: { color: '#DCE4EE', fontSize: 13, textAlign: 'center' },
});
