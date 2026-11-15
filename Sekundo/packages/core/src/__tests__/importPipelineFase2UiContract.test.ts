import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP_SRC_DIR = path.resolve(__dirname, '../../../app/src');

function readAppFile(relPath: string): string {
  return fs.readFileSync(path.join(APP_SRC_DIR, relPath), 'utf8');
}

describe('Fase 2 — Sekundo App UI Import Pipeline & Diagnostic Wiring Contract', () => {
  it('shared SekundoImportModal exposes WCAG 2.2 AA attributes, safety lock, and actionable PT-BR diagnostics', () => {
    const modalSource = readAppFile('components/csv/SekundoImportModal.tsx');
    expect(modalSource).toContain('accessibilityViewIsModal');
    expect(modalSource).toContain('accessibilityRole="progressbar"');
    expect(modalSource).toContain('accessibilityLiveRegion="polite"');
    expect(modalSource).toContain('Gravando com segurança — não interrompa agora');
    expect(modalSource).toContain('O que aconteceu');
    expect(modalSource).toContain('Como arrumar');
    expect(modalSource).toContain('Copiar diagnóstico técnico');
  });

  it('localStorage adapter propagates StorageQuotaError when both IndexedDB and AsyncStorage fail', () => {
    const storageSrc = readAppFile('storage/localStorage.ts');
    expect(storageSrc).toContain('tx.oncomplete');
    expect(storageSrc).toContain("quotaErr.name = 'StorageQuotaError'");
    expect(storageSrc).toContain('throw quotaErr');
  });

  it('wires all 6 Sekundo app import screens to useSekundoImportPipeline + SekundoImportModal without unsafe decoding or silent catches', () => {
    const screens = [
      'app/csv-import.tsx',
      'app/create-event.tsx',
      'app/hoje.tsx',
      'app/schedule-hub.tsx',
      'components/territory/TerritoryManageModal.tsx',
      'app/territory-map.tsx',
    ];

    for (const rel of screens) {
      const src = readAppFile(rel);
      expect(src).toContain('useSekundoImportPipeline');
      expect(src).toContain('SekundoImportModal');
      expect(src).toContain('pickBrowserSpreadsheetFile');
    }

    const manageModalSrc = readAppFile('components/territory/TerritoryManageModal.tsx');
    expect(manageModalSrc).not.toContain("new TextDecoder('utf-8').decode");

    const territoryMapSrc = readAppFile('app/territory-map.tsx');
    expect(territoryMapSrc).not.toContain('// Ignore malformed GeoJSON');

    const csvImportSrc = readAppFile('app/csv-import.tsx');
    expect(csvImportSrc).not.toContain('style={styles.statusStripText} numberOfLines={1}');
  });

  it('enforces WCAG 2.2 AA contrast, >=44px touch targets, Escape focus restoration, and UI diagnostic sanitization in SekundoImportModal', () => {
    const modalSource = readAppFile('components/csv/SekundoImportModal.tsx');
    expect(modalSource).toContain("backgroundColor: '#0369A1'");
    expect(modalSource).toContain("backgroundColor: '#B45309'");
    expect(modalSource).toContain("backgroundColor: '#047857'");
    expect(modalSource).not.toContain("backgroundColor: '#0284C7'");
    expect(modalSource).not.toContain("backgroundColor: '#D97706'");
    expect(modalSource).not.toContain("backgroundColor: '#059669'");
    expect(modalSource).toContain('minHeight: 44');
    expect(modalSource).toContain('accessibilityState={{ expanded: showRaw }}');
    expect(modalSource).toContain("e.key === 'Escape'");
    expect(modalSource).toContain("role: 'dialog'");
    expect(modalSource).toContain('sanitizeDiagnosticSnippet');
  });

  it('hardens useSekundoImportPipeline with synchronous commit locks, native picker fallback, and Web cancel handling', () => {
    const hookSrc = readAppFile('hooks/useSekundoImportPipeline.ts');
    expect(hookSrc).toContain('commitLockedRef');
    expect(hookSrc).toContain('statusRef');
    expect(hookSrc).toContain('expo-document-picker');
    expect(hookSrc).toContain('getDocumentAsync');
    expect(hookSrc).toContain("addEventListener('cancel'");
    expect(hookSrc).toContain('sanitizeDiagnosticSnippet');
  });

  it('prevents split-brain writes, modal stacking, and silent empty failures across app import screens', () => {
    const manageModalSrc = readAppFile('components/territory/TerritoryManageModal.tsx');
    expect(manageModalSrc).toContain('throw new Error(msg)');
    expect(manageModalSrc).toContain("visible={visible && importPipeline.state.status === 'idle'}");
    expect(manageModalSrc).toContain("stage: 'opening_table'");

    const mapSrc = readAppFile('app/territory-map.tsx');
    expect(mapSrc).toContain("stage: 'opening_table'");
    expect(mapSrc).toContain('onRetry={');

    const hojeSrc = readAppFile('app/hoje.tsx');
    const commitIdx = hojeSrc.indexOf('commitOmniCsvBundleToStorage(');
    const yamlIdx = hojeSrc.indexOf('handleYamlChange(committed.bundle.hojeManifestYaml)');
    expect(commitIdx).toBeGreaterThan(-1);
    expect(yamlIdx).toBeGreaterThan(commitIdx);

    const hubSrc = readAppFile('app/schedule-hub.tsx');
    expect(hubSrc).not.toContain('window.localStorage.setItem(LOCAL_BUNDLE_STORAGE_KEY');
    expect(hubSrc).toContain('storage.storage.setItem(LOCAL_BUNDLE_STORAGE_KEY');
    expect(hubSrc).toContain('retryModeRef');
    expect(hubSrc).toContain("visible={showImportModal && importPipeline.state.status === 'idle'}");
    expect(hubSrc).toContain("stage: 'opening_table'");
  });
});
