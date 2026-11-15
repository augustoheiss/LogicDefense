/**
 * SekundoImportModal Component (@sekundo/app)
 *
 * Accessible cooperative background progress & actionable PT-BR diagnostics modal
 * matching Sekundo's Sovereign Dark CAD aesthetic (`#0B1120` / `#38BDF8` / `#10B981`).
 *
 * Displays all 6 pipeline stages (`reading_file -> decoding -> parsing_rows ->
 * validating -> saving_storage -> opening_table`), enforces cancellation lock once
 * durable storage commits start, and surfaces "O que aconteceu" / "Como arrumar"
 * guidance with one-tap technical report copy.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  IMPORT_STAGE_ORDER,
  buildDiagnosticReportText,
  formatByteSize,
  sanitizeDiagnosticSnippet,
  type ImportDiagnosticIssue,
  type ImportPipelineState,
  type ImportStage,
} from '@sekundo/core';

const STAGE_SHORT_LABELS: Record<ImportStage, string> = {
  reading_file: 'Leitura',
  decoding: 'Codificação',
  parsing_rows: 'Linhas',
  validating: 'Validação',
  saving_storage: 'Cofre local',
  opening_table: 'Abertura',
};

export interface SekundoImportModalProps<T = unknown> {
  state: ImportPipelineState<T>;
  technicalReport?: string;
  onCancel?: () => void;
  onResolveWarning?: (proceed: boolean) => void;
  onRetry?: () => void;
  onDismiss: () => void;
  onSuccessAction?: (result?: T) => void;
  successActionLabel?: string;
  title?: string;
}

async function copyText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fallback to expo-clipboard
  }
  try {
    await Clipboard.setStringAsync(value);
    return true;
  } catch {
    return false;
  }
}

function SekundoDiagnosticCard({ issue }: { issue: ImportDiagnosticIssue }) {
  const isError = issue.severity === 'error';
  return (
    <View
      style={[
        styles.issueCard,
        isError ? styles.issueCardError : styles.issueCardWarning,
      ]}
      accessible
    >
      <View style={styles.issueBadges}>
        <View
          style={[
            styles.severityBadge,
            isError ? styles.severityError : styles.severityWarning,
          ]}
        >
          <Text style={styles.severityText}>
            {isError ? 'ERRO' : 'ATENÇÃO'} · {issue.code}
          </Text>
        </View>
        {typeof issue.lineNumber === 'number' && (
          <View style={styles.locationBadge}>
            <Text style={styles.locationText}>Linha {issue.lineNumber}</Text>
          </View>
        )}
        {issue.columnName && (
          <View style={styles.locationBadge}>
            <Text style={styles.locationText}>Coluna: {issue.columnName}</Text>
          </View>
        )}
      </View>

      <Text style={styles.issueTitle}>{issue.title}</Text>

      <Text style={styles.sectionHeader}>O que aconteceu</Text>
      <Text style={styles.sectionBody}>{issue.explanation}</Text>

      <Text style={[styles.sectionHeader, styles.fixHeader]}>Como arrumar</Text>
      <Text style={styles.fixBody}>{issue.howToFix}</Text>

      {issue.rawSample && (
        <View style={styles.rawBox}>
          <Text style={styles.rawLabel}>Trecho encontrado:</Text>
          <Text style={styles.rawCode} selectable numberOfLines={3}>
            {sanitizeDiagnosticSnippet(issue.rawSample, {
              maxLength: 240,
              neutralizeFormulas: true,
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

export function SekundoImportModal<T = unknown>({
  state,
  technicalReport,
  onCancel,
  onResolveWarning,
  onRetry,
  onDismiss,
  onSuccessAction,
  successActionLabel = 'Abrir agora',
  title = 'Processando Planilha',
}: SekundoImportModalProps<T>) {
  const { width } = useWindowDimensions();
  const isCompact = width < 480;

  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<any>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setCopied(false);
    setShowRaw(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [state.status]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const visible = state.status !== 'idle';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (visible) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      const focusTimer = setTimeout(() => {
        const node = cardRef.current;
        if (node && typeof node.focus === 'function') {
          try {
            node.focus();
          } catch {
            // Ignore non-focusable host views
          }
        }
      }, 0);
      return () => clearTimeout(focusTimer);
    }
    const prev = previousFocusRef.current;
    previousFocusRef.current = null;
    if (prev && typeof prev.focus === 'function' && prev.isConnected !== false) {
      try {
        prev.focus();
      } catch {
        // Ignore unmounted triggers
      }
    }
    return undefined;
  }, [visible]);

  const canDismiss = useMemo(() => {
    if (state.status === 'running') {
      return state.progress.cancellable;
    }
    return state.status !== 'idle';
  }, [state]);

  const effectiveReport = useMemo(() => {
    if (technicalReport && technicalReport.trim().length > 0) {
      return technicalReport;
    }
    if (state.status === 'error') {
      return buildDiagnosticReportText({
        fileName: state.fileName,
        stageFailed: state.stageFailed,
        summary: state.summary,
        issues: state.issues,
        rawErrorText: state.rawErrorText,
      });
    }
    if (state.status === 'warning_review') {
      return buildDiagnosticReportText({
        fileName: state.fileName,
        summary: state.summary,
        issues: state.issues,
      });
    }
    if (state.status === 'success' && state.warnings && state.warnings.length > 0) {
      return buildDiagnosticReportText({
        fileName: state.fileName,
        summary: state.summary,
        issues: state.warnings,
      });
    }
    return '';
  }, [state, technicalReport]);

  const handleRequestClose = useCallback(() => {
    if (!canDismiss) return;
    if (state.status === 'running') {
      onCancel?.();
      return;
    }
    if (state.status === 'warning_review') {
      onResolveWarning?.(false);
      return;
    }
    onDismiss();
  }, [canDismiss, onCancel, onDismiss, onResolveWarning, state.status]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, handleRequestClose]);

  const handleCopy = useCallback(async () => {
    if (!effectiveReport) return;
    const ok = await copyText(effectiveReport);
    if (ok) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2200);
    }
  }, [effectiveReport]);

  if (!visible) return null;

  const activeStageIdx =
    state.status === 'running'
      ? Math.max(0, IMPORT_STAGE_ORDER.indexOf(state.progress.stage))
      : IMPORT_STAGE_ORDER.length - 1;

  const percent =
    state.status === 'running' && typeof state.progress.percent === 'number'
      ? Math.max(0, Math.min(100, Math.round(state.progress.percent)))
      : Math.round(((activeStageIdx + 1) / IMPORT_STAGE_ORDER.length) * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View
          ref={cardRef}
          style={[styles.card, isCompact && styles.cardCompact]}
          {...(Platform.OS === 'web'
            ? ({ role: 'dialog', 'aria-modal': 'true', tabIndex: -1 } as any)
            : {})}
        >
          {state.status === 'running' && (
            <View accessibilityLiveRegion="polite">
              <View style={styles.headerRow}>
                <View style={styles.iconCircle}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                </View>
                <View style={styles.headerMeta}>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {state.progress.fileName || state.fileName}
                    {typeof (state.progress.sizeBytes ?? state.sizeBytes) === 'number'
                      ? ` · ${formatByteSize(state.progress.sizeBytes ?? state.sizeBytes)}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.percentPill}>
                  <Text style={styles.percentText}>{percent}%</Text>
                </View>
              </View>

              <Text style={styles.stageText}>{state.progress.stageLabel}</Text>
              {state.progress.detailLabel ? (
                <Text style={styles.detailText}>{state.progress.detailLabel}</Text>
              ) : null}

              <View
                style={styles.track}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: percent }}
                accessibilityLabel={state.progress.stageLabel}
              >
                <View style={[styles.fill, { width: `${percent}%` }]} />
              </View>

              {typeof state.progress.processedCount === 'number' && (
                <Text style={styles.counterText}>
                  {typeof state.progress.totalCount === 'number' && state.progress.totalCount > 0
                    ? `${state.progress.processedCount} de ${state.progress.totalCount} registros processados`
                    : `${state.progress.processedCount} registros processados`}
                </Text>
              )}

              <View style={styles.stepsWrap}>
                {IMPORT_STAGE_ORDER.map((stage, idx) => {
                  const done = idx < activeStageIdx;
                  const active = idx === activeStageIdx;
                  return (
                    <View
                      key={stage}
                      style={[
                        styles.stepPill,
                        done && styles.stepPillDone,
                        active && styles.stepPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepText,
                          done && styles.stepTextDone,
                          active && styles.stepTextActive,
                        ]}
                      >
                        {done ? '✓ ' : active ? '● ' : `${idx + 1}. `}
                        {STAGE_SHORT_LABELS[stage]}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.footerRow}>
                {state.progress.cancellable && onCancel ? (
                  <Pressable
                    style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                    onPress={onCancel}
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar importação"
                  >
                    <Text style={styles.secondaryBtnText}>Cancelar importação</Text>
                  </Pressable>
                ) : (
                  <View style={styles.safetyLockBanner}>
                    <Text style={styles.safetyLockText}>
                      Gravando com segurança — não interrompa agora
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {state.status === 'warning_review' && (
            <View accessibilityLiveRegion="polite">
              <View style={styles.headerRow}>
                <View style={[styles.iconCircle, styles.warnCircle]}>
                  <Text style={styles.warnGlyph}>!</Text>
                </View>
                <View style={styles.headerMeta}>
                  <Text style={styles.title}>Revise antes de gravar</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {state.fileName} · {state.validCount} válidas / {state.skippedCount} com aviso
                  </Text>
                </View>
              </View>

              <Text style={styles.summaryText}>{state.summary}</Text>

              <ScrollView style={styles.issuesScroll} nestedScrollEnabled>
                {state.issues.map((issue, i) => (
                  <SekundoDiagnosticCard key={`${issue.code}-${i}`} issue={issue} />
                ))}
              </ScrollView>

              <View style={styles.actionsCol}>
                {effectiveReport ? (
                  <Pressable
                    style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
                    onPress={handleCopy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.ghostBtnText}>
                      {copied ? '✓ Diagnóstico copiado' : 'Copiar diagnóstico técnico'}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.splitRow}>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                    onPress={() => onResolveWarning?.(false)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.warnBtn, pressed && styles.pressed]}
                    onPress={() => onResolveWarning?.(true)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>Continuar assim mesmo</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {state.status === 'error' && (
            <View accessibilityLiveRegion="assertive">
              <View style={styles.headerRow}>
                <View style={[styles.iconCircle, styles.errCircle]}>
                  <Text style={styles.errGlyph}>✕</Text>
                </View>
                <View style={styles.headerMeta}>
                  <Text style={styles.title}>Falha ao carregar planilha</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {state.fileName}
                    {state.stageFailed ? ` · Etapa: ${STAGE_SHORT_LABELS[state.stageFailed]}` : ''}
                  </Text>
                </View>
              </View>

              <ScrollView style={styles.issuesScroll} nestedScrollEnabled>
                {state.issues.map((issue, i) => (
                  <SekundoDiagnosticCard key={`${issue.code}-${i}`} issue={issue} />
                ))}

                {state.rawErrorText ? (
                  <View style={styles.rawToggleWrap}>
                    <Pressable
                      onPress={() => setShowRaw((prev) => !prev)}
                      style={styles.rawToggleBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Ver ou ocultar detalhe técnico"
                      accessibilityState={{ expanded: showRaw }}
                    >
                      <Text style={styles.rawToggleText}>
                        {showRaw ? '▾ Ocultar detalhe técnico' : '▸ Ver detalhe técnico'}
                      </Text>
                    </Pressable>
                    {showRaw && (
                      <View style={styles.rawBox}>
                        <Text style={styles.rawCode} selectable>
                          {sanitizeDiagnosticSnippet(state.rawErrorText, {
                            maxLength: 600,
                            neutralizeFormulas: true,
                          })}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.actionsCol}>
                {effectiveReport ? (
                  <Pressable
                    style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
                    onPress={handleCopy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.ghostBtnText}>
                      {copied ? '✓ Diagnóstico copiado' : 'Copiar diagnóstico técnico'}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.splitRow}>
                  {onRetry && (
                    <Pressable
                      style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                      onPress={onRetry}
                      accessibilityRole="button"
                    >
                      <Text style={styles.secondaryBtnText}>Selecionar outro arquivo</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                    onPress={onDismiss}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>Fechar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {state.status === 'success' && (
            <View accessibilityLiveRegion="polite">
              <View style={styles.headerRow}>
                <View style={[styles.iconCircle, styles.okCircle]}>
                  <Text style={styles.okGlyph}>✓</Text>
                </View>
                <View style={styles.headerMeta}>
                  <Text style={styles.title}>Planilha importada com sucesso</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {state.fileName}
                  </Text>
                </View>
              </View>

              <Text style={styles.summaryText}>{state.summary}</Text>

              {state.warnings && state.warnings.length > 0 && (
                <ScrollView style={styles.issuesScrollCompact} nestedScrollEnabled>
                  {state.warnings.map((w, i) => (
                    <SekundoDiagnosticCard key={`${w.code}-${i}`} issue={w} />
                  ))}
                </ScrollView>
              )}

              <View style={styles.actionsCol}>
                {effectiveReport ? (
                  <Pressable
                    style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
                    onPress={handleCopy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.ghostBtnText}>
                      {copied ? '✓ Diagnóstico copiado' : 'Copiar diagnóstico técnico'}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.splitRow}>
                  {onSuccessAction && (
                    <Pressable
                      style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                      onPress={onDismiss}
                      accessibilityRole="button"
                    >
                      <Text style={styles.secondaryBtnText}>Continuar aqui</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.emeraldBtn, pressed && styles.pressed]}
                    onPress={() => {
                      if (onSuccessAction) {
                        onSuccessAction(state.result);
                      } else {
                        onDismiss();
                      }
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>
                      {onSuccessAction ? successActionLabel : 'Abrir planilha'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 18, 0.84)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    backgroundColor: '#0B1120',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
  },
  cardCompact: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.40)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warnCircle: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  warnGlyph: {
    color: '#FBBF24',
    fontSize: 20,
    fontWeight: '800',
  },
  errCircle: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  errGlyph: {
    color: '#F87171',
    fontSize: 18,
    fontWeight: '800',
  },
  okCircle: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  okGlyph: {
    color: '#34D399',
    fontSize: 18,
    fontWeight: '800',
  },
  headerMeta: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 13,
    marginTop: 2,
  },
  percentPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.40)',
  },
  percentText: {
    color: '#7DD3FC',
    fontSize: 13,
    fontWeight: '800',
  },
  stageText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailText: {
    color: '#CBD5E1',
    fontSize: 13,
    marginBottom: 8,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    marginBottom: 8,
  },
  fill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 999,
  },
  counterText: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 12,
  },
  stepsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  stepPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  stepPillDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  stepPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  stepText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  stepTextDone: {
    color: '#6EE7B7',
  },
  stepTextActive: {
    color: '#BAE6FD',
    fontWeight: '700',
  },
  summaryText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  issuesScroll: {
    maxHeight: 300,
    marginBottom: 12,
  },
  issuesScrollCompact: {
    maxHeight: 200,
    marginBottom: 12,
  },
  issueCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  issueCardError: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.38)',
  },
  issueCardWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    borderColor: 'rgba(245, 158, 11, 0.38)',
  },
  issueBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  severityError: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  severityWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  severityText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  locationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
  },
  locationText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  issueTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionHeader: {
    color: '#CBD5E1',
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  sectionBody: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  fixHeader: {
    color: '#6EE7B7',
  },
  fixBody: {
    color: '#ECFDF5',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  rawBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#060A12',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  rawLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
  },
  rawCode: {
    color: '#F8FAFC',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rawToggleWrap: {
    marginTop: 4,
  },
  rawToggleBtn: {
    minHeight: 44,
    justifyContent: 'center',
  },
  rawToggleText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  footerRow: {
    marginTop: 4,
  },
  actionsCol: {
    gap: 8,
  },
  splitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  safetyLockBanner: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  safetyLockText: {
    color: '#BAE6FD',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  ghostBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ghostBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryBtn: {
    minHeight: 44,
    minWidth: 120,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    minHeight: 44,
    minWidth: 130,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0369A1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warnBtn: {
    minHeight: 44,
    minWidth: 160,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#B45309',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emeraldBtn: {
    minHeight: 44,
    minWidth: 150,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
