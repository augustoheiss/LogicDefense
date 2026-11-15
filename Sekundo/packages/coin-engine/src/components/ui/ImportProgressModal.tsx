/**
 * ImportProgressModal Component — Assistente Moeda (@sekundo/coin-engine)
 *
 * Accessible cooperative background loading overlay + diagnostic recovery dialog
 * rendered throughout `reading_file -> decoding -> parsing_rows -> validating ->
 * saving_storage -> opening_table`.
 *
 * WCAG 2.2 AA guarantees:
 *   - `accessibilityViewIsModal`, `accessibilityLiveRegion="polite"`, and
 *     `accessibilityRole="progressbar"` with numeric min/max/now values.
 *   - Minimum 44x44 touch targets on all action buttons.
 *   - Hardware Back / Web Escape only dismisses when `cancellable === true`.
 *   - Separate "O que aconteceu" and "Como arrumar" recovery guidance.
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
import { colors } from '@coin/theme/colors';
import { radius, spacing } from '@coin/theme/spacing';
import {
  IMPORT_STAGE_ORDER,
  buildDiagnosticReportText,
  formatByteSize,
  sanitizeDiagnosticSnippet,
  type ImportDiagnosticIssue,
  type ImportPipelineState,
  type ImportStage,
} from '@coin/services/importPipelineContract';

const SHORT_STAGE_LABELS: Record<ImportStage, string> = {
  reading_file: 'Leitura',
  decoding: 'Codificação',
  parsing_rows: 'Linhas',
  validating: 'Validação',
  saving_storage: 'Cofre local',
  opening_table: 'Abertura',
};

export interface ImportProgressModalProps<T = unknown> {
  state: ImportPipelineState<T>;
  technicalReport?: string;
  onCancel?: () => void;
  onResolveWarning?: (proceed: boolean) => void;
  onRetry?: () => void;
  onDismiss: () => void;
  onOpenTable?: (result?: T) => void;
  openTableLabel?: string;
  title?: string;
}

async function copyDiagnosticText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback to expo-clipboard below
  }

  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

function DiagnosticIssueCard({ issue }: { issue: ImportDiagnosticIssue }) {
  const isError = issue.severity === 'error';
  return (
    <View
      style={[
        styles.issueCard,
        isError ? styles.issueCardError : styles.issueCardWarning,
      ]}
      accessible
    >
      <View style={styles.issueHeaderRow}>
        <View
          style={[
            styles.severityPill,
            isError ? styles.severityPillError : styles.severityPillWarning,
          ]}
        >
          <Text style={styles.severityPillText}>
            {isError ? 'ERRO' : 'ATENÇÃO'} · {issue.code}
          </Text>
        </View>
        {typeof issue.lineNumber === 'number' && (
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>Linha {issue.lineNumber}</Text>
          </View>
        )}
        {issue.columnName && (
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>Coluna: {issue.columnName}</Text>
          </View>
        )}
      </View>

      <Text style={styles.issueTitle}>{issue.title}</Text>

      <Text style={styles.sectionLabel}>O que aconteceu</Text>
      <Text style={styles.sectionBody}>{issue.explanation}</Text>

      <Text style={[styles.sectionLabel, styles.howToFixLabel]}>Como arrumar</Text>
      <Text style={styles.howToFixBody}>{issue.howToFix}</Text>

      {issue.rawSample && (
        <View style={styles.rawSampleBox}>
          <Text style={styles.rawSampleLabel}>Trecho encontrado:</Text>
          <Text style={styles.rawSampleCode} selectable numberOfLines={3}>
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

export function ImportProgressModal<T = unknown>({
  state,
  technicalReport,
  onCancel,
  onResolveWarning,
  onRetry,
  onDismiss,
  onOpenTable,
  openTableLabel = 'Abrir planilha',
  title = 'Importação de Planilha',
}: ImportProgressModalProps<T>) {
  const { width } = useWindowDimensions();
  const isCompact = width < 480;

  const [copied, setCopied] = useState(false);
  const [showRawError, setShowRawError] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<any>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setCopied(false);
    setShowRawError(false);
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, [state.status]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
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

  const canDismissOrCancel = useMemo(() => {
    if (state.status === 'running') {
      return state.progress.cancellable;
    }
    return state.status !== 'idle';
  }, [state]);

  const effectiveReportText = useMemo(() => {
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
    if (!canDismissOrCancel) return;
    if (state.status === 'running') {
      onCancel?.();
      return;
    }
    if (state.status === 'warning_review') {
      onResolveWarning?.(false);
      return;
    }
    onDismiss();
  }, [canDismissOrCancel, onCancel, onDismiss, onResolveWarning, state.status]);

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

  const handleCopyReport = useCallback(async () => {
    if (!effectiveReportText) return;
    const ok = await copyDiagnosticText(effectiveReportText);
    if (ok) {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, 2200);
    }
  }, [effectiveReportText]);

  if (!visible) return null;

  const runningStageIdx =
    state.status === 'running'
      ? Math.max(0, IMPORT_STAGE_ORDER.indexOf(state.progress.stage))
      : IMPORT_STAGE_ORDER.length - 1;

  const rawPercent =
    state.status === 'running' && typeof state.progress.percent === 'number'
      ? state.progress.percent
      : Math.round(((runningStageIdx + 1) / IMPORT_STAGE_ORDER.length) * 100);
  const clampedPercent = Math.max(0, Math.min(100, Math.round(rawPercent)));

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
          style={[styles.dialogCard, isCompact && styles.dialogCardCompact]}
          {...(Platform.OS === 'web'
            ? ({ role: 'dialog', 'aria-modal': 'true', tabIndex: -1 } as any)
            : {})}
        >
          {state.status === 'running' && (
            <View accessibilityLiveRegion="polite">
              <View style={styles.headerRow}>
                <View style={styles.headerIconCircle}>
                  <ActivityIndicator size="small" color={colors.accent.purple} />
                </View>
                <View style={styles.headerTextCol}>
                  <Text style={styles.modalTitle}>{title}</Text>
                  <Text style={styles.fileSubtitle} numberOfLines={1}>
                    {state.progress.fileName || state.fileName}
                    {typeof (state.progress.sizeBytes ?? state.sizeBytes) === 'number'
                      ? ` · ${formatByteSize(state.progress.sizeBytes ?? state.sizeBytes)}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.percentBadge}>
                  <Text style={styles.percentText}>{clampedPercent}%</Text>
                </View>
              </View>

              <Text style={styles.activeStageLabel}>{state.progress.stageLabel}</Text>
              {state.progress.detailLabel ? (
                <Text style={styles.detailLabel}>{state.progress.detailLabel}</Text>
              ) : null}

              <View
                style={styles.progressTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: clampedPercent }}
                accessibilityLabel={state.progress.stageLabel}
              >
                <View style={[styles.progressFill, { width: `${clampedPercent}%` }]} />
              </View>

              {typeof state.progress.processedCount === 'number' && (
                <Text style={styles.counterText}>
                  {typeof state.progress.totalCount === 'number' && state.progress.totalCount > 0
                    ? `${state.progress.processedCount} de ${state.progress.totalCount} registros processados`
                    : `${state.progress.processedCount} registros processados`}
                </Text>
              )}

              <View style={styles.stepperContainer}>
                {IMPORT_STAGE_ORDER.map((stage, idx) => {
                  const isDone = idx < runningStageIdx;
                  const isActive = idx === runningStageIdx;
                  return (
                    <View
                      key={stage}
                      style={[
                        styles.stepPill,
                        isDone && styles.stepPillDone,
                        isActive && styles.stepPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepPillText,
                          isDone && styles.stepPillTextDone,
                          isActive && styles.stepPillTextActive,
                        ]}
                      >
                        {isDone ? '✓ ' : isActive ? '● ' : `${idx + 1}. `}
                        {SHORT_STAGE_LABELS[stage]}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.footerRow}>
                {state.progress.cancellable && onCancel ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      pressed && styles.btnPressed,
                    ]}
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
                <View style={[styles.headerIconCircle, styles.warningIconCircle]}>
                  <Text style={styles.warningIconText}>!</Text>
                </View>
                <View style={styles.headerTextCol}>
                  <Text style={styles.modalTitle}>Atenção antes de concluir</Text>
                  <Text style={styles.fileSubtitle} numberOfLines={1}>
                    {state.fileName} · {state.validCount} válidas / {state.skippedCount} com aviso
                  </Text>
                </View>
              </View>

              <Text style={styles.summaryText}>{state.summary}</Text>

              <ScrollView style={styles.issuesScroll} nestedScrollEnabled>
                {state.issues.map((issue, idx) => (
                  <DiagnosticIssueCard key={`${issue.code}-${idx}`} issue={issue} />
                ))}
              </ScrollView>

              <View style={styles.actionsWrap}>
                {effectiveReportText ? (
                  <Pressable
                    style={({ pressed }) => [styles.ghostBtn, pressed && styles.btnPressed]}
                    onPress={handleCopyReport}
                    accessibilityRole="button"
                  >
                    <Text style={styles.ghostBtnText}>
                      {copied ? '✓ Diagnóstico copiado' : 'Copiar diagnóstico técnico'}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.footerSplitRow}>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
                    onPress={() => onResolveWarning?.(false)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.warningCtaBtn, pressed && styles.btnPressed]}
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
                <View style={[styles.headerIconCircle, styles.errorIconCircle]}>
                  <Text style={styles.errorIconText}>✕</Text>
                </View>
                <View style={styles.headerTextCol}>
                  <Text style={styles.modalTitle}>Não foi possível importar a planilha</Text>
                  <Text style={styles.fileSubtitle} numberOfLines={1}>
                    {state.fileName}
                    {state.stageFailed ? ` · Etapa: ${SHORT_STAGE_LABELS[state.stageFailed]}` : ''}
                  </Text>
                </View>
              </View>

              <ScrollView style={styles.issuesScroll} nestedScrollEnabled>
                {state.issues.map((issue, idx) => (
                  <DiagnosticIssueCard key={`${issue.code}-${idx}`} issue={issue} />
                ))}

                {state.rawErrorText ? (
                  <View style={styles.rawToggleWrap}>
                    <Pressable
                      onPress={() => setShowRawError((prev) => !prev)}
                      style={styles.rawToggleBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Ver ou ocultar detalhe técnico bruto"
                      accessibilityState={{ expanded: showRawError }}
                    >
                      <Text style={styles.rawToggleText}>
                        {showRawError
                          ? '▾ Ocultar detalhe técnico bruto'
                          : '▸ Ver detalhe técnico bruto'}
                      </Text>
                    </Pressable>
                    {showRawError && (
                      <View style={styles.rawSampleBox}>
                        <Text style={styles.rawSampleCode} selectable>
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

              <View style={styles.actionsWrap}>
                {effectiveReportText ? (
                  <Pressable
                    style={({ pressed }) => [styles.ghostBtn, pressed && styles.btnPressed]}
                    onPress={handleCopyReport}
                    accessibilityRole="button"
                  >
                    <Text style={styles.ghostBtnText}>
                      {copied ? '✓ Diagnóstico copiado' : 'Copiar diagnóstico técnico'}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.footerSplitRow}>
                  {onRetry && (
                    <Pressable
                      style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
                      onPress={onRetry}
                      accessibilityRole="button"
                    >
                      <Text style={styles.secondaryBtnText}>Tentar outro arquivo</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                    onPress={onDismiss}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>Entendi</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {state.status === 'success' && (
            <View accessibilityLiveRegion="polite">
              <View style={styles.headerRow}>
                <View style={[styles.headerIconCircle, styles.successIconCircle]}>
                  <Text style={styles.successIconText}>✓</Text>
                </View>
                <View style={styles.headerTextCol}>
                  <Text style={styles.modalTitle}>Planilha carregada com sucesso</Text>
                  <Text style={styles.fileSubtitle} numberOfLines={1}>
                    {state.fileName}
                  </Text>
                </View>
              </View>

              <Text style={styles.summaryText}>{state.summary}</Text>

              {state.warnings && state.warnings.length > 0 && (
                <ScrollView style={styles.issuesScrollCompact} nestedScrollEnabled>
                  {state.warnings.map((w, idx) => (
                    <DiagnosticIssueCard key={`${w.code}-${idx}`} issue={w} />
                  ))}
                </ScrollView>
              )}

              <View style={styles.actionsWrap}>
                {effectiveReportText ? (
                  <Pressable
                    style={({ pressed }) => [styles.ghostBtn, pressed && styles.btnPressed]}
                    onPress={handleCopyReport}
                    accessibilityRole="button"
                  >
                    <Text style={styles.ghostBtnText}>
                      {copied ? '✓ Diagnóstico copiado' : 'Copiar diagnóstico técnico'}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.footerSplitRow}>
                  {onOpenTable && (
                    <Pressable
                      style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
                      onPress={onDismiss}
                      accessibilityRole="button"
                    >
                      <Text style={styles.secondaryBtnText}>Fechar</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.successCtaBtn, pressed && styles.btnPressed]}
                    onPress={() => {
                      if (onOpenTable) {
                        onOpenTable(state.result);
                      } else {
                        onDismiss();
                      }
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>
                      {onOpenTable ? openTableLabel : 'Abrir planilha'}
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
    backgroundColor: 'rgba(6, 10, 18, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.xl,
  },
  dialogCardCompact: {
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.accent.purpleLight,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningIconCircle: {
    backgroundColor: colors.warning.light,
    borderColor: colors.warning.border,
  },
  warningIconText: {
    color: colors.warning.main,
    fontSize: 20,
    fontWeight: '800',
  },
  errorIconCircle: {
    backgroundColor: colors.danger.light,
    borderColor: colors.danger.border,
  },
  errorIconText: {
    color: colors.danger.main,
    fontSize: 18,
    fontWeight: '800',
  },
  successIconCircle: {
    backgroundColor: colors.success.light,
    borderColor: colors.success.border,
  },
  successIconText: {
    color: colors.success.main,
    fontSize: 18,
    fontWeight: '800',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  fileSubtitle: {
    color: '#CBD5E1',
    fontSize: 13,
    marginTop: 2,
  },
  percentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.accent.purpleLight,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
  },
  percentText: {
    color: '#E9D5FF',
    fontSize: 13,
    fontWeight: '700',
  },
  activeStageLabel: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  detailLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.purple,
    borderRadius: radius.full,
  },
  counterText: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: spacing.md,
  },
  stepperContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  stepPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  stepPillDone: {
    backgroundColor: colors.success.light,
    borderColor: colors.success.border,
  },
  stepPillActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  stepPillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  stepPillTextDone: {
    color: '#6EE7B7',
  },
  stepPillTextActive: {
    color: '#E9D5FF',
    fontWeight: '700',
  },
  summaryText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  issuesScroll: {
    maxHeight: 300,
    marginBottom: spacing.md,
  },
  issuesScrollCompact: {
    maxHeight: 200,
    marginBottom: spacing.md,
  },
  issueCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  issueCardError: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  issueCardWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  issueHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  severityPillError: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
  },
  severityPillWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
  },
  severityPillText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  metaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  metaBadgeText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  issueTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.xs,
  },
  sectionBody: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  howToFixLabel: {
    color: '#6EE7B7',
  },
  howToFixBody: {
    color: '#ECFDF5',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  rawSampleBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  rawSampleLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  rawSampleCode: {
    color: '#F8FAFC',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rawToggleWrap: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
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
    marginTop: spacing.xs,
  },
  actionsWrap: {
    gap: spacing.sm,
  },
  footerSplitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  safetyLockBanner: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.info.light,
    borderWidth: 1,
    borderColor: colors.info.border,
  },
  safetyLockText: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  ghostBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
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
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    minHeight: 44,
    minWidth: 130,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: '#7E22CE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningCtaBtn: {
    minHeight: 44,
    minWidth: 160,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: '#B45309',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCtaBtn: {
    minHeight: 44,
    minWidth: 150,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.8,
  },
});
