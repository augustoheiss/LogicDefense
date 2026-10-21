import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  sanitizeLegacySensitiveText,
  normalizePdfTemplateId,
  buildTerritoriosS13HistoricalRegistry,
  PROGRAMACAO_PARTICIPANT_DIRECTORY,
  buildProgramacaoReuniaoRegistry,
} from '../schedule/programacaoReuniaoSeed';
import {
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  CAPABILITY_COLUMNS,
} from '../roster/privilegeRotationEngine';

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && entry.name !== 'cleanRoomHygieneGate.test.ts') {
      out.push(full);
    }
  }
  return out;
}

describe('Clean-Room Hygiene Gate & Sanitizer Paradox Shield (Bloco 1)', () => {
  it('replaces structural legacy form codes and template slugs without literal numeric dictionaries', () => {
    const sample =
      'Template Fichas de Designação 4-Up (X-99-Y) com arquivo x99-4up.sdoc.yaml e pdf:x13s-multiciclo.';
    const res = sanitizeLegacySensitiveText(sample);
    expect(res.changed).toBe(true);
    expect(res.text).not.toContain('x99-4up.sdoc.yaml');
    expect(res.text).toContain('fichas-4up.sdoc.yaml');
    expect(res.text).toContain('pdf:territorios-multiciclo');
  });

  it('normalizes PDF template IDs to clean-room slugs (slips_4up and territory_ledger)', () => {
    expect(normalizePdfTemplateId('slips_4up')).toBe('slips_4up');
    expect(normalizePdfTemplateId('territory_ledger')).toBe('territory_ledger');
    expect(normalizePdfTemplateId('fichas-4up')).toBe('slips_4up');
    expect(normalizePdfTemplateId('territorios-multiciclo')).toBe('territory_ledger');
    expect(normalizePdfTemplateId('legacy_4up_form')).toBe('slips_4up');
    expect(normalizePdfTemplateId('custom')).toBe('custom');
  });

  it('seeds synthetic participant directory and territory registry with 100% generic identifiers and valid geo coordinates', () => {
    expect(PROGRAMACAO_PARTICIPANT_DIRECTORY.length).toBeGreaterThanOrEqual(16);
    for (const p of PROGRAMACAO_PARTICIPANT_DIRECTORY) {
      expect(p.name).toMatch(/^Participante \d{2}$/);
      expect(p.groupTag).toMatch(/^Grupo \d+$/);
    }

    expect(DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS.length).toBe(24);
    for (const p of DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS) {
      expect(p.name).toMatch(/^Participante \d{2}$/);
      expect(p.groupTag).toMatch(/^Grupo [123]$/);
      expect(['perfil_a', 'perfil_b']).toContain(p.profileCategory);
      expect(['coordenador_senior', 'assistente_tecnico', 'operador_base']).toContain(p.roleTier);
    }
    expect(CAPABILITY_COLUMNS.length).toBe(26);

    const scheduleEntries = buildProgramacaoReuniaoRegistry();
    expect(scheduleEntries.length).toBeGreaterThan(20);

    const territories = buildTerritoriosS13HistoricalRegistry();
    expect(territories.length).toBe(16);
    for (const entry of territories) {
      const meta = (entry.meta || {}) as Record<string, any>;
      expect(typeof meta.lat).toBe('number');
      expect(typeof meta.lng).toBe('number');
      expect(Array.isArray(meta.polygon)).toBe(true);
      expect(meta.polygon.length).toBeGreaterThanOrEqual(4);
      expect(typeof meta.zone).toBe('string');
      expect(typeof meta.neighborhood).toBe('string');
      expect(typeof meta.city).toBe('string');
    }
  });

  it('enforces zero Sanitizer Paradox dictionaries, personal fallback names, or legacy external URLs across core, coin-engine, and app source files', () => {
    const repoRoot = path.resolve(__dirname, '../../../..');
    const coreFiles = collectSourceFiles(path.join(repoRoot, 'packages/core/src'));
    const coinFiles = collectSourceFiles(path.join(repoRoot, 'packages/coin-engine/src'));
    const appFiles = collectSourceFiles(path.join(repoRoot, 'packages/app/src'));
    const allFiles = [...coreFiles, ...coinFiles, ...appFiles];
    expect(allFiles.length).toBeGreaterThan(80);

    // Build patterns dynamically so this test file itself contains zero literal proprietary tokens
    const legacyArrayIdentifier = ['LEGACY', 'SENSITIVE', 'REPLACEMENTS'].join('_');
    const legacyRenderHost = ['ocorrencias', 'pdf', 'writer'].join('-');
    const forbiddenPiiPattern = new RegExp(
      '\\b(' +
        [
          'Jo\\u00e3o',
          '\\u0042runo',
          '\\u0043arlos',
          '\\u004darcos',
          'Andr\\u00e9',
          '\\u0052oberto',
          '\\u004eelson',
          '\\u0050inhais',
          '\\u0041zaleias',
        ].join('|') +
        ')\\b'
    );

    const violations: string[] = [];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(repoRoot, file);
      if (content.includes(legacyArrayIdentifier)) {
        violations.push(`${rel}: contains ${legacyArrayIdentifier}`);
      }
      if (content.includes(legacyRenderHost)) {
        violations.push(`${rel}: contains legacy external host ${legacyRenderHost}`);
      }
      const piiMatch = content.match(forbiddenPiiPattern);
      if (piiMatch) {
        violations.push(`${rel}: contains personal name "${piiMatch[0]}"`);
      }
    }

    expect(violations).toEqual([]);
  });
});
