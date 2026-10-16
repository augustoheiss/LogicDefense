import { describe, it, expect } from 'vitest';
import {
  buildTerritoriosS13HistoricalRegistry,
  buildProgramacaoReuniaoRegistry,
  generateTerritoryS13AndCardsPDF,
  S13S_MULTICYCLE_SDOC_YAML,
  S89_4UP_SDOC_YAML,
  compileSdocToPdf,
  buildS13PageContexts,
} from '../index';

describe('Phase F2 — Multi-Cycle Territory & 4-Up Declarative SDOC Parity Tests', () => {
  it('chunks territory T01.01.01 with 9 cycles (in 2026) into 3 visual rows in both legacy and SDOC engines', async () => {
    const registry = buildTerritoriosS13HistoricalRegistry();
    const pages2026 = buildS13PageContexts(registry, '2026');
    expect(pages2026.length).toBeGreaterThanOrEqual(1);

    const t01Rows = pages2026[0].rows.filter((r) => r.territoryNumber === 'T01.01.01');
    // T01.01.01 has 9 cycles in 2026 -> ceil(9 / 4) = 3 rows
    expect(t01Rows).toHaveLength(3);

    const legacyResult = await generateTerritoryS13AndCardsPDF(registry, {
      serviceYear: '2026',
      includeQuadraCards: false,
    });
    const sdocResult = await compileSdocToPdf(S13S_MULTICYCLE_SDOC_YAML, registry, {
      serviceYear: '2026',
      stampPageNumbers: true,
    });

    expect(sdocResult.displayList.pages.length).toBe(1);
    expect(sdocResult.pdfBytes.byteLength).toBeGreaterThan(1500);
    expect(legacyResult.rowCount).toBe(pages2026[0].rowCount);

    // Verify all territory numbers present in the solved DisplayList text operations
    const allRenderedText = sdocResult.displayList.pages[0].ops
      .filter((op) => op.kind === 'text')
      .flatMap((op) => (op as any).lines)
      .join(' ');

    expect(allRenderedText).toContain('CONTROLE OPERACIONAL DE SETORES E CICLOS');
    expect(allRenderedText).toContain('2026');
    expect(allRenderedText).toContain('T01.01.01');
    expect(allRenderedText).toContain('SEKUNDO ENGINE');
  });

  it('compiles S89_4UP_SDOC_YAML with 12 assignments into 3 pages (4-up per page)', async () => {
    const progRegistry = buildProgramacaoReuniaoRegistry();
    const twelveSlots = progRegistry.filter((e) => e.value && e.value.trim() !== '').slice(0, 12);
    expect(twelveSlots.length).toBe(12);

    const { displayList, pdfBytes } = await compileSdocToPdf(S89_4UP_SDOC_YAML, twelveSlots);
    expect(displayList.pages).toHaveLength(3);
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });
});
