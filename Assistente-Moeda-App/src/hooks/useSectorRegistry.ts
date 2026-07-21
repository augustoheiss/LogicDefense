import { useCallback, useMemo } from 'react';
import { useCoinDB } from './useCoinDB';

export interface Sector {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export const ALL_SECTORS: Sector[] = [
  {
    id: 'personal_finance',
    label: 'Finanças Pessoais',
    description: 'Controle de receitas, despesas pessoais, investimentos e projeções de longo prazo.',
    icon: '👤',
  },
  {
    id: 'smb_accounting',
    label: 'Contabilidade PME',
    description: 'Gestão de capital de giro, fluxo de caixa em risco (CFaR), margem operacional e estoque.',
    icon: '🏢',
  },
  {
    id: 'real_estate',
    label: 'Imobiliário',
    description: 'Simulações de financiamentos (Price/SAC), rendimentos reais deflacionados e depreciação física.',
    icon: '🏠',
  },
  {
    id: 'vehicles',
    label: 'Frotas & Veículos',
    description: 'Gestão de TCO (Custo Total de Propriedade), custo por quilômetro (CPK) e manutenção preventiva.',
    icon: '🚗',
  },
  {
    id: 'legal_taxes',
    label: 'Jurídico & Tributário',
    description: 'Simulações do Fator R, Lucro Presumido, IRPF 2026, IRPFM e correção de débitos trabalhistas/cíveis.',
    icon: '⚖️',
  },
];

export function useSectorRegistry() {
  const { activeTable, updateGoals } = useCoinDB();

  const activeSectors = useMemo<string[]>(() => {
    if (!activeTable) return ['personal_finance'];
    return activeTable.activeSectors || ['personal_finance'];
  }, [activeTable]);

  const isSectorActive = useCallback(
    (sectorId: string) => {
      return activeSectors.includes(sectorId);
    },
    [activeSectors]
  );

  const setSectors = useCallback(
    (sectors: string[]) => {
      if (!activeTable) return;
      // Guarantee at least personal_finance if empty
      const updatedSectors = sectors.length === 0 ? ['personal_finance'] : sectors;
      
      // We can update the goals or properties of the table. Wait, does useCoinDB support updating activeSectors?
      // We will add support for it in useCoinDB!
      // In useCoinDB, we will expose a method to update the active table or we can piggyback on updateGoals/updateTable
      // Let's add updateActiveSectors to useCoinDB and type check it properly.
      // For now, let's call the typecast version if we add it to the CoinDBState interface.
      const dbState = useCoinDB() as any;
      if (dbState.updateActiveSectors) {
        dbState.updateActiveSectors(updatedSectors);
      }
    },
    [activeTable]
  );

  const toggleSector = useCallback(
    (sectorId: string) => {
      if (activeSectors.includes(sectorId)) {
        // Don't allow disabling the only active sector
        if (activeSectors.length <= 1) return;
        setSectors(activeSectors.filter((id) => id !== sectorId));
      } else {
        setSectors([...activeSectors, sectorId]);
      }
    },
    [activeSectors, setSectors]
  );

  return {
    allSectors: ALL_SECTORS,
    activeSectors,
    isSectorActive,
    toggleSector,
    setSectors,
  };
}
