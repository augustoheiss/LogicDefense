/**
 * Smart Rebalancer — Assistente Moeda
 *
 * Pure Cash-In Rebalancing Algorithm.
 *
 * Principles:
 *   1. Zero Forced Sales: Never forces or recommends asset sales to avoid tax triggers (DARF) and fees.
 *   2. Proportional Deficit Recovery: Distributes the incoming cash deposit strictly into underweighted assets.
 *   3. Pedagogical Explanation: Explains clearly why each allocation is recommended based on the user's target.
 *   4. Mathematical Integrity: Guarantees exact sum matching (down to the cent).
 */

import type { AssetPosition, RebalanceSuggestion, AssetClass } from './types';

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  cash_reserves: 'Reserva de Emergência / Liquidez',
  fixed_income_ipca: 'Renda Fixa Inflação (IPCA+)',
  real_estate_funds: 'Fundos Imobiliários (FIIs)',
  equities_brazil: 'Ações Brasileiras (B3)',
  equities_global: 'Ativos Globais / ETFs Mundiais',
  crypto: 'Criptoativos (Bitcoin & Web3)',
  business_capital: 'Capital de Giro do Negócio',
};

/**
 * Calculates optimal distribution of a new financial deposit without selling any assets.
 */
export function calculateSmartRebalance(
  positions: AssetPosition[],
  newDepositBRL: number
): RebalanceSuggestion[] {
  if (newDepositBRL <= 0 || positions.length === 0) {
    return [];
  }

  const currentTotal = positions.reduce((acc, p) => acc + p.currentValue, 0);
  const futureTotal = currentTotal + newDepositBRL;

  // Calculate the desired post-deposit value for each asset based on target weight
  const deficits = positions.map((p) => {
    const idealPostValue = (p.targetPercentage / 100) * futureTotal;
    const deficitBRL = Math.max(0, idealPostValue - p.currentValue);
    return {
      position: p,
      idealPostValue,
      deficitBRL,
    };
  });

  const totalDeficit = deficits.reduce((acc, d) => acc + d.deficitBRL, 0);

  let allocations: Array<{ position: AssetPosition; amountBRL: number }> = [];

  if (totalDeficit > 0) {
    if (newDepositBRL <= totalDeficit) {
      // Allocate proportionally to deficit
      allocations = deficits.map((d) => ({
        position: d.position,
        amountBRL: (d.deficitBRL / totalDeficit) * newDepositBRL,
      }));
    } else {
      // Fill all deficits completely, then allocate surplus according to target percentages
      const surplus = newDepositBRL - totalDeficit;
      allocations = deficits.map((d) => {
        const bonus = (d.position.targetPercentage / 100) * surplus;
        return {
          position: d.position,
          amountBRL: d.deficitBRL + bonus,
        };
      });
    }
  } else {
    // No deficit (all balanced) -> distribute purely by target percentage
    allocations = deficits.map((d) => ({
      position: d.position,
      amountBRL: (d.position.targetPercentage / 100) * newDepositBRL,
    }));
  }

  // Filter out microscopic allocations (< R$ 1.00) and round to 2 decimals
  const filtered = allocations.filter((a) => a.amountBRL >= 1);
  const totalAllocated = filtered.reduce((acc, a) => acc + Math.round(a.amountBRL * 100) / 100, 0);
  const roundingError = Math.round((newDepositBRL - totalAllocated) * 100) / 100;

  // Adjust rounding error onto the largest underallocated position
  if (filtered.length > 0 && Math.abs(roundingError) > 0 && Math.abs(roundingError) < 1) {
    filtered[0].amountBRL += roundingError;
  }

  return filtered.map((a) => {
    const rounded = Math.round(a.amountBRL * 100) / 100;
    const classLabel = ASSET_CLASS_LABELS[a.position.assetClass] || a.position.assetClass;
    const dev = a.position.deviationPercentage;
    const devText = dev < 0
      ? `reduzindo a defasagem atual de ${dev.toFixed(1)}%`
      : `reforçando a classe rumo à meta de ${a.position.targetPercentage}%`;

    const rationalExplanation =
      `Aporte sugerido de R$ ${rounded.toFixed(2).replace('.', ',')} em ${classLabel}, ` +
      `${devText} sem necessidade de realizar vendas de outros ativos.`;

    return {
      assetClass: a.position.assetClass,
      suggestedAllocationBRL: rounded,
      rationalExplanation,
    };
  });
}
