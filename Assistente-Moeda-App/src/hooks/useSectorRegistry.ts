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
    id: 'core_cashflow',
    label: 'Fluxo de Caixa',
    description: 'Saldo acumulado linha a linha e previsão de liquidez.',
    icon: '📊',
  },
  {
    id: 'core_revenue',
    label: 'Receitas & Faturamento',
    description: 'Categorização de faturamento, origens de renda e recorrência.',
    icon: '📈',
  },
  {
    id: 'core_costs',
    label: 'Custos & Despesas',
    description: 'Classificação de custos fixos/variáveis, centros de custo e drenos.',
    icon: '📉',
  },
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
  const { activeTable } = useCoinDB();

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
      const dbState = useCoinDB() as any;
      if (dbState.updateActiveSectors) {
        dbState.updateActiveSectors(sectors);
      }
    },
    [activeTable]
  );

  const toggleSector = useCallback(
    (sectorId: string) => {
      if (activeSectors.includes(sectorId)) {
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
