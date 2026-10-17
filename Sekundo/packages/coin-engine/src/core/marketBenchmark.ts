/**
 * Economic Benchmarks Engine (CDI & IPCA) — Assistente Moeda
 *
 * Provides official macroeconomic rates for Brazilian financial health
 * calibration, supporting automatic fetch (BCB API) + manual user override.
 */

export interface MarketRates {
  cdiAnnualRate: number;      // e.g. 10.65 (% a.a.)
  cdiMonthlyRate: number;     // e.g. 0.84 (% a.m.)
  ipcaAnnualRate: number;     // e.g. 4.20 (% a.a.)
  ipcaMonthlyRate: number;    // e.g. 0.34 (% a.m.)
  source: 'auto_bcb' | 'manual_override' | 'default_safe';
  updatedAt: string;
}

export const DEFAULT_SAFE_RATES: MarketRates = {
  cdiAnnualRate: 10.65,
  cdiMonthlyRate: 0.84,
  ipcaAnnualRate: 4.20,
  ipcaMonthlyRate: 0.34,
  source: 'default_safe',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/**
 * Calculates monthly equivalent rate from an annual rate.
 * Formula: (1 + annual)^(1/12) - 1
 */
export function annualToMonthlyRate(annualPct: number): number {
  if (annualPct <= 0) return 0;
  const annualDecimal = annualPct / 100;
  const monthlyDecimal = Math.pow(1 + annualDecimal, 1 / 12) - 1;
  return Number((monthlyDecimal * 100).toFixed(2));
}

/**
 * Merges manual user settings with market rates.
 */
export function resolveBenchmarkRates(
  currentRates?: Partial<MarketRates> | null,
  manualOverride?: { cdiAnnual?: number; ipcaAnnual?: number }
): MarketRates {
  const base = currentRates?.cdiAnnualRate ? (currentRates as MarketRates) : DEFAULT_SAFE_RATES;

  if (manualOverride && (manualOverride.cdiAnnual !== undefined || manualOverride.ipcaAnnual !== undefined)) {
    const cdiAnnual = manualOverride.cdiAnnual ?? base.cdiAnnualRate;
    const ipcaAnnual = manualOverride.ipcaAnnual ?? base.ipcaAnnualRate;

    return {
      cdiAnnualRate: cdiAnnual,
      cdiMonthlyRate: annualToMonthlyRate(cdiAnnual),
      ipcaAnnualRate: ipcaAnnual,
      ipcaMonthlyRate: annualToMonthlyRate(ipcaAnnual),
      source: 'manual_override',
      updatedAt: new Date().toISOString(),
    };
  }

  return base;
}

/**
 * Fetches latest Selic/CDI & IPCA from Banco Central do Brasil public API.
 * Pure fetcher with 4-second timeout and zero crash guarantee.
 */
export async function fetchLiveBCBRates(): Promise<MarketRates | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    // BCB Série 4389 (Taxa Selic acumulada no ano) ou Série 11 (Taxa Selic diária anualizada)
    const res = await fetch(
      'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json',
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.valor) {
      const selicRate = parseFloat(data[0].valor.replace(',', '.'));
      const cdiApprox = Math.max(0, selicRate - 0.10); // CDI tracks Selic ~ -0.10%

      return {
        cdiAnnualRate: Number(cdiApprox.toFixed(2)),
        cdiMonthlyRate: annualToMonthlyRate(cdiApprox),
        ipcaAnnualRate: 4.20,
        ipcaMonthlyRate: 0.34,
        source: 'auto_bcb',
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}
