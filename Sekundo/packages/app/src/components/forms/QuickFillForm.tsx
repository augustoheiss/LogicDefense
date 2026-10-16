import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { SdocDocument, SdocField, PreflightReport, FormFieldValue } from '@sekundo/core';

export interface QuickFillFormProps {
  sdoc: SdocDocument | null;
  values: Record<string, FormFieldValue>;
  onChangeField: (key: string, value: string | boolean) => void;
  preflight: PreflightReport | null;
  onExportFlattenedPdf: (forceFlattenSigned?: boolean) => void;
  onExportEditablePdf: () => void;
  onExportUnsignedCopy?: () => void;
  onExportFormYaml: () => void;
  onSelectFieldOnCanvas?: (fieldId: string, page?: number) => void;
}

function getFieldKey(field: SdocField): string {
  if (field.name && field.name.trim()) return field.name.trim();
  const rawBind = field.bind.trim();
  if (rawBind.startsWith('=')) return field.id;
  return rawBind.replace(/^input\./, '') || field.id;
}

export function QuickFillForm({
  sdoc,
  values,
  onChangeField,
  preflight,
  onExportFlattenedPdf,
  onExportEditablePdf,
  onExportUnsignedCopy,
  onExportFormYaml,
  onSelectFieldOnCanvas,
}: QuickFillFormProps) {
  const [confirmSignatureFlatten, setConfirmSignatureFlatten] = useState(false);

  // N-6 & H12: Hide signature fields (/FT /Sig) and deduplicate multi-widget fields by key
  const fields = React.useMemo(() => {
    const raw = (sdoc?.fields || []).filter((f) => f.fieldType !== 'signature');
    const byKey = new Map<string, SdocField & { allPages: number[] }>();
    for (const f of raw) {
      const k = getFieldKey(f);
      const existing = byKey.get(k);
      const pg = f.page || 1;
      if (existing) {
        if (!existing.allPages.includes(pg)) existing.allPages.push(pg);
      } else {
        byKey.set(k, { ...f, allPages: [pg] });
      }
    }
    return Array.from(byKey.values());
  }, [sdoc?.fields]);

  const hasSignature = Boolean(sdoc?.underlay?.hasSignature || preflight?.blocksSilentFlatten);

  const actionableIssues = (preflight?.issues || []).filter((i) => i.severity !== 'info');
  const errorsCount = actionableIssues.filter((i) => i.severity === 'error').length;
  const warningsCount = actionableIssues.filter((i) => i.severity === 'warning').length;

  const handlePrimaryExport = () => {
    if (hasSignature && !confirmSignatureFlatten) {
      setConfirmSignatureFlatten(true);
      return;
    }
    setConfirmSignatureFlatten(false);
    onExportFlattenedPdf(true);
  };

  return (
    <View style={styles.container} testID="quickfill-form-panel">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚡ Preencher Rápido ({fields.length} campos)</Text>
        <TouchableOpacity
          testID="quickfill-export-form-yaml-btn"
          style={styles.yamlChip}
          onPress={onExportFormYaml}
        >
          <Text style={styles.yamlChipText}>💾 .form.yaml</Text>
        </TouchableOpacity>
      </View>

      {/* Preflight Diagnostics Banner (H2, H3, H4, H7, U2, U7, U8) */}
      {actionableIssues.length > 0 && (
        <View style={styles.preflightBox} testID="quickfill-preflight-banner">
          <Text style={styles.preflightTitle}>
            🩺 Pré-Voo Documental ({errorsCount} erro(s), {warningsCount} aviso(s))
          </Text>
          {actionableIssues.slice(0, 4).map((iss, idx) => (
            <Text
              key={`${iss.code}-${idx}`}
              style={[
                styles.preflightItem,
                iss.severity === 'error' ? styles.preflightError : styles.preflightWarn,
              ]}
            >
              {iss.severity === 'error' ? '⛔' : '⚠️'} [{iss.code}] {iss.message}
            </Text>
          ))}
        </View>
      )}

      {/* Signature Guard Confirmation (R5.3 / Decision 1) */}
      {hasSignature && confirmSignatureFlatten && (
        <View style={styles.sigGuardBox} testID="quickfill-sig-guard">
          <Text style={styles.sigGuardText}>
            🔏 Este PDF possui assinatura digital criptográfica (/Sig). Editar ou regravar o PDF invalidará a assinatura original.
          </Text>
          <View style={styles.sigGuardActions}>
            <TouchableOpacity
              testID="quickfill-sig-cancel-btn"
              style={styles.sigSafeBtn}
              onPress={() => setConfirmSignatureFlatten(false)}
            >
              <Text style={styles.sigBtnText}>✖ Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="quickfill-sig-use-editable-btn"
              style={styles.sigForceBtn}
              onPress={() => {
                setConfirmSignatureFlatten(false);
                if (onExportUnsignedCopy) {
                  onExportUnsignedCopy();
                } else {
                  onExportFlattenedPdf(true);
                }
              }}
            >
              <Text style={styles.sigBtnText}>📄 Exportar Cópia sem Assinatura</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {fields.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Nenhum campo de formulário detectado neste documento.
            </Text>
            <Text style={styles.emptySubtext}>
              Suba um PDF com campos interativos ou adicione elementos no Inspetor.
            </Text>
          </View>
        ) : (
          fields.map((field) => {
            const key = getFieldKey(field);
            const rawVal = values[key] ?? values[field.id] ?? field.defaultValue ?? '';
            const strVal = typeof rawVal === 'boolean' ? (rawVal ? 'true' : 'false') : String(rawVal);
            const isChecked =
              rawVal === true ||
              ['true', '1', 'sim', 'yes', 'x', 'on'].includes(strVal.toLowerCase());
            const isOverMax =
              typeof field.maxLength === 'number' && strVal.length > field.maxLength;
            const pageLabel =
              field.allPages.length > 1
                ? `Págs. ${field.allPages.join(', ')}`
                : field.page && field.page > 1
                  ? `Pág. ${field.page}`
                  : null;

            return (
              <View key={field.id} style={styles.fieldCard}>
                <TouchableOpacity
                  style={styles.fieldHeader}
                  onPress={() => onSelectFieldOnCanvas?.(field.id, field.page)}
                >
                  <Text style={styles.fieldLabel}>{key}</Text>
                  <View style={styles.badgesRow}>
                    {pageLabel && <Text style={styles.pageBadge}>{pageLabel}</Text>}
                    {typeof field.maxLength === 'number' && (
                      <Text
                        style={[
                          styles.lengthBadge,
                          isOverMax && styles.lengthBadgeExceeded,
                        ]}
                      >
                        {strVal.length}/{field.maxLength}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {field.fieldType === 'checkbox' ? (
                  <TouchableOpacity
                    testID={`quickfill-checkbox-${key}`}
                    style={[styles.checkboxBtn, isChecked && styles.checkboxBtnChecked]}
                    onPress={() => onChangeField(key, !isChecked)}
                  >
                    <Text style={styles.checkboxText}>
                      {isChecked ? '☑ Marcado (Sim)' : '☐ Desmarcado (Não)'}
                    </Text>
                  </TouchableOpacity>
                ) : field.options && field.options.length > 0 ? (
                  <View style={styles.optionsWrap}>
                    {field.options.map((opt) => {
                      const active = strVal === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          testID={`quickfill-opt-${key}-${opt}`}
                          style={[styles.optionPill, active && styles.optionPillActive]}
                          onPress={() => onChangeField(key, opt)}
                        >
                          <Text
                            style={[
                              styles.optionPillText,
                              active && styles.optionPillTextActive,
                            ]}
                          >
                            {active ? `● ${opt}` : `○ ${opt}`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <TextInput
                    testID={`quickfill-input-${key}`}
                    style={[styles.textInput, isOverMax && styles.textInputError]}
                    value={strVal}
                    onChangeText={(txt) => onChangeField(key, txt)}
                    placeholder={field.defaultValue || `Digite ${key}...`}
                    placeholderTextColor="#64748B"
                  />
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Dual Export Footer per §8.4: Flattened Default + Editable Secondary */}
      <View style={styles.footer}>
        <TouchableOpacity
          testID="quickfill-export-flattened-btn"
          style={styles.primaryExportBtn}
          onPress={handlePrimaryExport}
        >
          <Text style={styles.primaryExportText}>
            📤 Compartilhar / Exportar (Final Achatado)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="quickfill-export-editable-btn"
          style={styles.secondaryExportBtn}
          onPress={onExportEditablePdf}
        >
          <Text style={styles.secondaryExportText}>
            📝 Exportar como Formulário Editável (AcroForm)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerTitle: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  yamlChip: { backgroundColor: '#1E293B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: '#334155' },
  yamlChipText: { color: '#38BDF8', fontSize: 10, fontWeight: '700' },
  preflightBox: { backgroundColor: '#1E1B4B', borderBottomWidth: 1, borderBottomColor: '#312E81', paddingHorizontal: 12, paddingVertical: 8, gap: 3 },
  preflightTitle: { color: '#E0E7FF', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  preflightItem: { fontSize: 10.5 },
  preflightError: { color: '#FCA5A5' },
  preflightWarn: { color: '#FDE68A' },
  sigGuardBox: { backgroundColor: '#451A03', borderBottomWidth: 1, borderBottomColor: '#92400E', padding: 10, gap: 8 },
  sigGuardText: { color: '#FEF3C7', fontSize: 11, fontWeight: '600' },
  sigGuardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sigSafeBtn: { backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  sigForceBtn: { backgroundColor: '#B45309', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  sigBtnText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 10, gap: 10 },
  emptyBox: { padding: 20, alignItems: 'center', gap: 6 },
  emptyText: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  emptySubtext: { color: '#64748B', fontSize: 11, textAlign: 'center' },
  fieldCard: { backgroundColor: '#1E293B', borderRadius: 7, padding: 9, borderWidth: 1, borderColor: '#334155', gap: 6 },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { color: '#E2E8F0', fontSize: 11.5, fontWeight: '700' },
  badgesRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  pageBadge: { color: '#93C5FD', backgroundColor: '#172554', fontSize: 9.5, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  lengthBadge: { color: '#94A3B8', fontSize: 10, fontFamily: 'monospace' },
  lengthBadgeExceeded: { color: '#F87171', fontWeight: '700' },
  textInput: { backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: 12, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 5, borderWidth: 1, borderColor: '#334155' },
  textInputError: { borderColor: '#EF4444' },
  checkboxBtn: { backgroundColor: '#0F172A', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 5, borderWidth: 1, borderColor: '#334155' },
  checkboxBtnChecked: { backgroundColor: '#064E3B', borderColor: '#10B981' },
  checkboxText: { color: '#F8FAFC', fontSize: 11.5, fontWeight: '600' },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionPill: { backgroundColor: '#0F172A', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: '#334155' },
  optionPillActive: { backgroundColor: '#1D4ED8', borderColor: '#60A5FA' },
  optionPillText: { color: '#CBD5E1', fontSize: 11 },
  optionPillTextActive: { color: '#FFFFFF', fontWeight: '700' },
  footer: { padding: 10, borderTopWidth: 1, borderTopColor: '#1E293B', gap: 6, backgroundColor: '#090D16' },
  primaryExportBtn: { backgroundColor: '#2563EB', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center' },
  primaryExportText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },
  secondaryExportBtn: { backgroundColor: '#1E293B', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  secondaryExportText: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
});
