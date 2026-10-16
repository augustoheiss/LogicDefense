import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import type {
  S89Assignment,
  FieldMappingCandidate,
  TemplateRecognitionResult,
  TerritoryRecencyItem,
} from '@sekundo/core';

export interface CustomPdfSectionProps {
  uploadedFileName: string | null;
  recognitionResult: TemplateRecognitionResult | null;
  fieldMappings: FieldMappingCandidate[];
  mailMergeAllRecords: boolean;
  onSetMailMergeAllRecords: (val: boolean) => void;
  onPickCustomPDF: () => void;
  onGenerateCustomPDF: () => void;
}

export function CustomPdfSection({
  uploadedFileName,
  recognitionResult,
  fieldMappings,
  mailMergeAllRecords,
  onSetMailMergeAllRecords,
  onPickCustomPDF,
  onGenerateCustomPDF,
}: CustomPdfSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>ARQUIVO PDF DO USUÁRIO</Text>

      <Pressable onPress={onPickCustomPDF} style={styles.uploadDropZone}>
        <Text style={styles.uploadIcon}>📄</Text>
        <Text style={styles.uploadTitle}>
          {uploadedFileName
            ? `Arquivo: ${uploadedFileName}`
            : 'Clique para selecionar qualquer arquivo PDF'}
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
                Hash: {recognitionResult.templateHash.slice(0, 16)}... •{' '}
                {recognitionResult.totalFieldsDetected} campos detectados
              </Text>
            </View>
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceBadgeText}>
                {Math.round(recognitionResult.overallConfidence * 100)}% Confiança
              </Text>
            </View>
          </View>

          <View style={styles.mappingList}>
            <Text style={styles.mappingListHeader}>
              CAMPOS DETECTADOS & MAPEAMENTO SEMÂNTICO:
            </Text>
            {fieldMappings.map((m, idx) => (
              <View key={idx} style={styles.mappingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldIdText}>{m.pdfFieldName}</Text>
                  <Text style={styles.mappedAttrText}>
                    Mapeado para:{' '}
                    <Text style={{ color: '#38BDF8', fontWeight: '700' }}>
                      {m.matchedAttribute}
                    </Text>
                  </Text>
                </View>

                <View style={styles.mappingRight}>
                  <View
                    style={[
                      styles.confidencePill,
                      m.confidence >= 0.8 ? styles.pillHigh : styles.pillMedium,
                    ]}
                  >
                    <Text style={styles.confidencePillText}>
                      {Math.round(m.confidence * 100)}%
                    </Text>
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

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() => onSetMailMergeAllRecords(false)}
              style={[
                styles.mergeBtn,
                !mailMergeAllRecords && styles.mergeBtnSampleActive,
              ]}
            >
              <Text
                style={{
                  color: !mailMergeAllRecords ? '#FFB800' : '#94A3B8',
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                📄 1º Registro (Amostra)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onSetMailMergeAllRecords(true)}
              style={[
                styles.mergeBtn,
                mailMergeAllRecords && styles.mergeBtnAllActive,
              ]}
            >
              <Text
                style={{
                  color: mailMergeAllRecords ? '#34D399' : '#94A3B8',
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                📑 Mala Direta (Todos os Registros)
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={onGenerateCustomPDF} style={styles.fillCustomBtn}>
            <Text style={styles.fillCustomBtnText}>
              ⚡ Preencher PDF com Dados do Sekundo (1-Click)
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export interface TerritoryS13SectionProps {
  s13ServiceYear: 'all' | '2027' | '2026';
  onSetS13ServiceYear: (yr: 'all' | '2027' | '2026') => void;
  territoryRecencySummary: TerritoryRecencyItem[];
  loading: boolean;
  onGenerateS13AndCards: () => void;
}

export function TerritoryS13Section({
  s13ServiceYear,
  onSetS13ServiceYear,
  territoryRecencySummary,
  loading,
  onGenerateS13AndCards,
}: TerritoryS13SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        RESUMO DE TERRITÓRIOS PARA REGISTRO MULTI-CICLO (4 COLUNAS) & CARTÕES DE QUADRA
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['all', '2027', '2026'] as const).map((yr) => (
          <Pressable
            key={yr}
            onPress={() => onSetS13ServiceYear(yr)}
            style={[
              styles.yearChip,
              s13ServiceYear === yr && styles.yearChipActive,
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: s13ServiceYear === yr ? '#FFB800' : '#94A3B8',
              }}
            >
              {yr === 'all' ? '📑 Ciclos 2027 + 2026' : `📅 Ciclo Operacional ${yr}`}
            </Text>
          </Pressable>
        ))}
      </View>
      {territoryRecencySummary.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhum território encontrado na árvore ativa.</Text>
        </View>
      ) : (
        territoryRecencySummary.map((t, idx) => (
          <View key={idx} style={styles.assignmentPreviewRow}>
            <View style={styles.badgeQuadrant}>
              <Text style={styles.badgeQuadrantText}>{t.territoryNumber}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.assigneeName}>
                {t.label} — {t.workedUnits}/{t.totalUnits} ({t.percent}%)
              </Text>
              <Text style={styles.assigneeMeta}>
                Designado: {t.assignedAt || '—'} • Concluído: {t.completedAt || 'Em andamento'}
              </Text>
            </View>
          </View>
        ))
      )}
      <View style={styles.actionContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#FFB800" />
        ) : (
          <Pressable onPress={onGenerateS13AndCards} style={styles.generateButton}>
            <Text style={styles.generateButtonText}>
              ⚡ Gerar e Baixar PDF Registro Multi-Ciclo + Cartões de Quadra (100% Local)
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export interface S89AssignmentsSectionProps {
  extractedAssignments: S89Assignment[];
  loading: boolean;
  onGenerateS89: () => void;
}

export function S89AssignmentsSection({
  extractedAssignments,
  loading,
  onGenerateS89,
}: S89AssignmentsSectionProps) {
  return (
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

      <View style={styles.actionContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#FFB800" />
        ) : (
          <Pressable onPress={onGenerateS89} style={styles.generateButton}>
            <Text style={styles.generateButtonText}>
              ⚡ Compilar e Baixar PDF Preenchido (1-Click)
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6B7A90', letterSpacing: 1, marginBottom: 12 },
  uploadDropZone: { backgroundColor: '#121722', borderWidth: 2, borderColor: 'rgba(59, 130, 246, 0.4)', borderStyle: 'dashed', borderRadius: 12, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8 },
  uploadIcon: { fontSize: 32 },
  uploadTitle: { color: '#F0F4F8', fontSize: 15, fontWeight: '700' },
  uploadDesc: { color: '#8A99AD', fontSize: 12, textAlign: 'center' },
  recognitionCard: { marginTop: 16, backgroundColor: '#161D2B', borderRadius: 12, borderWidth: 1, borderColor: '#242F45', padding: 18, gap: 14 },
  recognitionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.06)', paddingBottom: 12 },
  recognitionTitle: { color: '#F0F4F8', fontSize: 16, fontWeight: '800' },
  recognitionSub: { color: '#8A99AD', fontSize: 11, marginTop: 2 },
  confidenceBadge: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: '#10B981', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  confidenceBadgeText: { color: '#34D399', fontSize: 12, fontWeight: '800' },
  mappingList: { gap: 8 },
  mappingListHeader: { color: '#6B7A90', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  mappingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#121722', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  fieldIdText: { color: '#F0F4F8', fontSize: 13, fontWeight: '700' },
  mappedAttrText: { color: '#8A99AD', fontSize: 11, marginTop: 2 },
  mappingRight: { alignItems: 'flex-end', gap: 4 },
  confidencePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pillHigh: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  pillMedium: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  confidencePillText: { color: '#F0F4F8', fontSize: 10, fontWeight: '700' },
  samplePreviewText: { color: '#6B7A90', fontSize: 11, fontStyle: 'italic', maxWidth: 160 },
  mergeBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#242F45', backgroundColor: '#121722', alignItems: 'center' },
  mergeBtnSampleActive: { borderColor: '#FFB800', backgroundColor: 'rgba(255, 184, 0, 0.14)' },
  mergeBtnAllActive: { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.14)' },
  fillCustomBtn: { backgroundColor: '#10B981', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  fillCustomBtnText: { color: '#062016', fontSize: 14, fontWeight: '800' },
  yearChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#263042', backgroundColor: '#121824' },
  yearChipActive: { borderColor: '#FFB800', backgroundColor: 'rgba(255, 184, 0, 0.16)' },
  emptyBox: { padding: 20, backgroundColor: '#121722', borderRadius: 8, borderWidth: 1, borderColor: '#1E2638', alignItems: 'center' },
  emptyText: { color: '#6B7A90', fontSize: 13 },
  assignmentPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#121722', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1E2638', marginBottom: 8 },
  badgeQuadrant: { backgroundColor: 'rgba(255, 184, 0, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeQuadrantText: { color: '#FFB800', fontSize: 11, fontWeight: '700' },
  assigneeName: { color: '#F0F4F8', fontSize: 14, fontWeight: '600' },
  assigneeMeta: { color: '#8A99AD', fontSize: 12, marginTop: 2 },
  actionContainer: { marginTop: 12, alignItems: 'center' },
  generateButton: { backgroundColor: '#FFB800', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 10, alignItems: 'center', width: '100%' },
  generateButtonText: { color: '#0A0D14', fontSize: 15, fontWeight: '700' },
});
