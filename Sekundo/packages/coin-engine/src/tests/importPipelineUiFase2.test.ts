/**
 * Fase 2 — UI Loading & Diagnostic Recovery Tests (@sekundo/coin-engine)
 *
 * Clean-room synthetic test suite validating:
 *   1. Stage-based cancellation lock (`saving_storage` & `opening_table` force `cancellable: false`).
 *   2. Structured raw error formatting (`extractRawErrorText`).
 *   3. Pipeline error/diagnostic mapping integration for quota exceeded, binary mismatch, and empty CSV.
 *   4. Static contract verification that all 4 Coin import UI screens use cooperative async parsing,
 *      `useImportPipeline`, `ImportProgressModal`, and `strictPersistence: true` without blocking alerts.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  sanitizeProgressCancellable,
  STAGE_NON_CANCELLABLE,
  extractRawErrorText,
} from '../hooks/useImportPipeline';
import {
  sanitizeDiagnosticSnippet,
  mapImportErrorToDiagnostics,
  buildDiagnosticReportText,
} from '../services/importPipelineContract';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (actual: any) => any;

function readCoinFile(relPath: string): string {
  const fullPath = path.resolve(process.cwd(), 'src', relPath);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Fase 2 — Coin Engine UI Loading Overlay & Error Recovery Contracts', () => {
  it('enforces cancellation lock on saving_storage and opening_table stages', () => {
    expect(STAGE_NON_CANCELLABLE.has('saving_storage')).toBe(true);
    expect(STAGE_NON_CANCELLABLE.has('opening_table')).toBe(true);

    const lockedSave = sanitizeProgressCancellable({
      stage: 'saving_storage',
      stageLabel: 'Gravando...',
      cancellable: true,
      percent: 90,
    });
    expect(lockedSave.cancellable).toBe(false);

    const lockedOpen = sanitizeProgressCancellable({
      stage: 'opening_table',
      stageLabel: 'Abrindo...',
      cancellable: true,
      percent: 100,
    });
    expect(lockedOpen.cancellable).toBe(false);

    const unlockedParse = sanitizeProgressCancellable({
      stage: 'parsing_rows',
      stageLabel: 'Lendo...',
      cancellable: true,
      percent: 45,
    });
    expect(unlockedParse.cancellable).toBe(true);
  });

  it('extracts readable technical details and builds PT-BR StorageQuotaError diagnostics', () => {
    const quotaErr = new Error('StorageQuotaError: QuotaExceededError 5MB reached');
    quotaErr.name = 'StorageQuotaError';
    const rawText = extractRawErrorText(quotaErr);
    expect(rawText).toContain('QuotaExceededError');

    const issues = mapImportErrorToDiagnostics(quotaErr, {
      fileName: 'dados_sinteticos_empresa.csv',
      stageFailed: 'saving_storage',
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].code).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(issues[0].howToFix.length).toBeGreaterThan(15);

    const report = buildDiagnosticReportText({
      fileName: 'dados_sinteticos_empresa.csv',
      stageFailed: 'saving_storage',
      summary: issues[0].title,
      issues,
      rawErrorText: rawText,
    });
    expect(report).toContain('STORAGE_QUOTA_EXCEEDED');
    expect(report).toContain('Como arrumar');
  });

  it('ImportProgressModal implements WCAG 2.2 AA roles, safety lock text, and recovery sections', () => {
    const modalSource = readCoinFile('components/ui/ImportProgressModal.tsx');
    expect(modalSource).toContain('accessibilityViewIsModal');
    expect(modalSource).toContain('accessibilityRole="progressbar"');
    expect(modalSource).toContain('accessibilityLiveRegion="polite"');
    expect(modalSource).toContain('Gravando com segurança — não interrompa agora');
    expect(modalSource).toContain('O que aconteceu');
    expect(modalSource).toContain('Como arrumar');
    expect(modalSource).toContain('Copiar diagnóstico técnico');

    const barrel = readCoinFile('components/ui/index.ts');
    expect(barrel).toContain("export { ImportProgressModal } from './ImportProgressModal';");
  });

  it('wires all 4 Coin UI import entry points to useImportPipeline, ImportProgressModal, and parseCSVTextAsync', () => {
    const entryPoints = [
      'app/(app)/(tabs)/transactions.tsx',
      'components/CSVImporter.tsx',
      'components/ui/ExampleCSVGalleryModal.tsx',
      'components/ui/TableSwitcherModal.tsx',
    ];

    for (const file of entryPoints) {
      const content = readCoinFile(file);
      expect(content).toContain('useImportPipeline');
      expect(content).toContain('ImportProgressModal');
      expect(content).toContain('parseCSVTextAsync');
      expect(content).toContain('strictPersistence: true');
    }

    const csvImporter = readCoinFile('components/CSVImporter.tsx');
    expect(csvImporter).not.toContain('window.alert(');

    const galleryModal = readCoinFile('components/ui/ExampleCSVGalleryModal.tsx');
    expect(galleryModal).not.toContain("Alert.alert(\n        'Erro ao carregar exemplo'");
  });

  it('sanitizes CWE-1236 formulas, XSS vectors, and PII inside coin diagnostics contract', () => {
    const formula = sanitizeDiagnosticSnippet('=cmd|calc!A0', { neutralizeFormulas: true });
    expect(formula.startsWith("'=cmd")).toBe(true);

    const sanitized = sanitizeDiagnosticSnippet(
      '<script>x</script> javascript:alert(1) onload=1 a@exemplo.com cpf 000.111.222-33 am_live_synth88776655 am_sheet_example_fictitious',
      { maxLength: 500 }
    );
    expect(sanitized).toContain('[SCRIPT REMOVIDO]');
    expect(sanitized).toContain('javascript_blocked:');
    expect(sanitized).toContain('on_attr_blocked=');
    expect(sanitized).toContain('[EMAIL REDIGIDO]');
    expect(sanitized).toContain('[CPF REDIGIDO]');
    expect(sanitized).toContain('[CHAVE_REDIGIDA]');
    expect(sanitized).toContain('am_sheet_example_fictitious');
  });

  it('enforces WCAG 2.2 AA contrast, touch targets, Escape, sibling modal isolation, and atomic sync in Coin UI', () => {
    const hookSrc = readCoinFile('hooks/useImportPipeline.ts');
    expect(hookSrc).toContain('commitLockedRef');
    expect(hookSrc).toContain('statusRef');

    const progressModalSrc = readCoinFile('components/ui/ImportProgressModal.tsx');
    expect(progressModalSrc).toContain("backgroundColor: '#7E22CE'");
    expect(progressModalSrc).toContain("backgroundColor: '#B45309'");
    expect(progressModalSrc).toContain("backgroundColor: '#047857'");
    expect(progressModalSrc).not.toContain("backgroundColor: '#a855f7'");
    expect(progressModalSrc).not.toContain("backgroundColor: '#D97706'");
    expect(progressModalSrc).not.toContain("backgroundColor: '#059669'");
    expect(progressModalSrc).toContain('minHeight: 44');
    expect(progressModalSrc).toContain('accessibilityState={{ expanded: showRawError }}');
    expect(progressModalSrc).toContain("e.key === 'Escape'");
    expect(progressModalSrc).toContain("role: 'dialog'");

    const switcherSrc = readCoinFile('components/ui/TableSwitcherModal.tsx');
    expect(switcherSrc).toContain('canCloseSwitcher');
    expect(switcherSrc).toContain('visible={visible && canCloseSwitcher}');
    const modalCloseIdx = switcherSrc.indexOf('</Modal>');
    const galleryMountIdx = switcherSrc.indexOf('<ExampleCSVGalleryModal');
    expect(modalCloseIdx).toBeGreaterThan(-1);
    expect(galleryMountIdx).toBeGreaterThan(modalCloseIdx);

    const gallerySrc = readCoinFile('components/ui/ExampleCSVGalleryModal.tsx');
    expect(gallerySrc).toContain("visible={visible && importPipeline.state.status === 'idle'}");
    expect(gallerySrc).toContain('minHeight: 44');
    expect(gallerySrc).toContain('feedbackTimerRef');

    const textModalSrc = readCoinFile('components/ui/CSVTextImporterModal.tsx');
    expect(textModalSrc).toContain('visible={visible && !hasActiveOverlayModal}');

    const importerSrc = readCoinFile('components/CSVImporter.tsx');
    expect(importerSrc).toContain('pendingSuccessRef');
    expect(importerSrc).toContain('renderContainer');

    const txSrc = readCoinFile('app/(app)/(tabs)/transactions.tsx');
    expect(txSrc).not.toContain('window.alert(summary)');

    const coinDbSrc = readCoinFile('hooks/useCoinDB.ts');
    const persistIdx = coinDbSrc.indexOf('await persist(updatedTables');
    const syncIdx = coinDbSrc.indexOf('emitCoinSyncRequested({', persistIdx);
    expect(persistIdx).toBeGreaterThan(-1);
    expect(syncIdx).toBeGreaterThan(persistIdx);
  });
});
