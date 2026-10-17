import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import { useSectorRegistry } from '@coin/hooks/useSectorRegistry';

interface SectorBlueprintMeta {
  shortCode: string;
  guideSummary: string;
  interactiveStep: string;
  toolsIncluded: string[];
   discardedBloatNote: string;
}

export const SECTOR_AUTOCAD_META: Record<string, SectorBlueprintMeta> = {
  core_cashflow: {
    shortCode: 'CAIXA',
    guideSummary: 'Mostra seu saldo líquido real, Raio-X por fatias (Pizza BI) e projeção de liquidez para 13 semanas.',
    interactiveStep: 'Acione os botões 🍩 (Pizza BI), 🌊 (13 Semanas) ou 🗂️ (Categorias) no palco central.',
    toolsIncluded: ['🍩 Raio-X Pizza BI', '🌊 Fluxo 13 Semanas', '🗂️ Filtro de Categorias'],
    discardedBloatNote: 'Foco 100% nos lançamentos reais da sua planilha.',
  },
  core_revenue: {
    shortCode: 'RECEITA',
    guideSummary: 'Analisa faturamento bruto, médias (diária/semanal/mensal/anual) e estatísticas reais (mediana, moda e volatilidade).',
    interactiveStep: 'Acione 💰 (Médias), 📐 (Estatísticas) ou 🤝 (Parcerias) para inspecionar ganhos sem rolar a tela.',
    toolsIncluded: ['💰 Médias de Receita', '📐 Mediana & Moda', '🤝 Repasses de Parceria'],
    discardedBloatNote: 'Conectado direto às entradas positivas e metas da planilha.',
  },
  core_costs: {
    shortCode: 'CUSTOS',
    guideSummary: 'Calcula seu custo mínimo de sobrevivência (diário/semanal/mensal) e a divisão 50/30/20 do orçamento.',
    interactiveStep: 'Acione 🛡️ (Sobrevivência) ou ⚖️ (Regra 50/30/20) para calibrar seu teto de gastos.',
    toolsIncluded: ['🛡️ Teto de Sobrevivência', '⚖️ Regra 50/30/20', '📉 Cobertura Anual'],
    discardedBloatNote: 'Sem formulários manuais redundantes.',
  },
  personal_finance: {
    shortCode: 'PFM',
    guideSummary: 'Simulador de Independência Financeira (Monte Carlo FIRE) e alocação de carteira conectados ao seu patrimônio.',
    interactiveStep: 'Acione 🔥 (Monte Carlo FIRE), ⚖️ (Orçamento 50/30/20) ou 🌊 (Choque 13 Semanas) no centro da tela.',
    toolsIncluded: ['🔥 Longevidade FIRE', '⚖️ Alocação 50/30/20', '🌊 Choque de Caixa 13 Sem.'],
    discardedBloatNote: 'Expurgados checklists artificiais e CSVs de teste desconectados.',
  },
  smb_accounting: {
    shortCode: 'PME',
    guideSummary: 'Calculadora executiva para empresas: Necessidade de Capital de Giro (NCG), Fluxo em Risco (CFaR) e Custo de Folha CLT.',
    interactiveStep: 'Acione 🔄 (Capital de Giro), 🎲 (Risco CFaR) ou 👷 (Folha & Encargos) para simular sua operação.',
    toolsIncluded: ['🔄 Capital de Giro & DRP', '🎲 Risco de Caixa (CFaR)', '👷 Multiplicador de Folha CLT'],
    discardedBloatNote: 'Expurgado parser SPED/Plano de Contas bruto que exigia rolagem extensa.',
  },
  real_estate: {
    shortCode: 'IMÓVEL',
    guideSummary: 'Compara financiamento Price vs. SAC com amortização extraordinária e calcula o Yield Real de aluguel (descontando IPCA).',
    interactiveStep: 'Acione 🏦 (Price vs SAC) ou 📈 (Yield Real de Aluguel) para ver a economia de juros na hora.',
    toolsIncluded: ['🏦 Price vs SAC + Amortização', '📈 Cap Rate & Yield Real', '🏚️ Vacância & Depreciação'],
    discardedBloatNote: 'Expurgados auditores de Holdings LLC estrangeiras e cofres ZK fictícios.',
  },
  vehicles: {
    shortCode: 'FROTA',
    guideSummary: 'Calcula o Custo Real por Quilômetro (CPK), compara Carro Próprio vs. Uber/App (36m) e lucro líquido por hora.',
    interactiveStep: 'Acione ⛽ (Custo/Km), 🚕 (Carro vs. Uber) ou ⏱️ (Lucro/Hora) para decidir com precisão matemática.',
    toolsIncluded: ['⛽ Custo por Km (CPK)', '🚕 Carro Próprio vs. Uber', '⏱️ Ganho Líquido / Hora'],
    discardedBloatNote: 'Expurgadas planilhas de restauração de chassi/pintura e CSVs de 27 colunas.',
  },
  legal_taxes: {
    shortCode: 'FISCAL',
    guideSummary: 'Otimizador tributário prático: Fator R (Anexo III 6% vs Anexo V 15,5%), Simples vs. Presumido, IRPF 2026 e PGBL.',
    interactiveStep: 'Acione 🧾 (Fator R & PJ), 🦁 (IRPF 2026 & PGBL) ou ⚖️ (Correção SELIC/IPCA) no painel central.',
    toolsIncluded: ['🧾 Fator R (Anexo III vs V)', '🦁 IRPF 2026 & Restituição PGBL', '⚖️ Correção Monetária SELIC'],
    discardedBloatNote: 'Expurgados medidores de intimação offshore (Cayman/Suíça) e HIPAA.',
  },
};

export function SectorSettingsPanel({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { allSectors, activeSectors, toggleSector, isSectorActive } = useSectorRegistry();
  const [inspectedSectorId, setInspectedSectorId] = useState<string>(allSectors[0]?.id || 'core_cashflow');

  const inspectedSector = allSectors.find((s) => s.id === inspectedSectorId) || allSectors[0];
  const inspectedMeta = SECTOR_AUTOCAD_META[inspectedSector.id] || SECTOR_AUTOCAD_META.core_cashflow;
  const isInspectedActive = isSectorActive(inspectedSector.id);
  const isOnlyOne = activeSectors.length <= 1 && isInspectedActive;

  return (
    <View style={[styles.container, compact && styles.containerCompact]} testID="cad-sector-matrix">
      {/* Header Enxuto AutoCAD */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle} testID="cad-sector-matrix-title">
            📐 Matriz AutoCAD de Módulos ({Math.min(activeSectors.length, allSectors.length)}/{allSectors.length} ativos)
          </Text>
          <Text style={styles.sectionSubtitle}>
            Toque em um botão abaixo (sem descrições longas) para o guia central explicar e ativar/desativar na hora.
          </Text>
        </View>
      </View>

      {/* Grade Central de Botões sem Descrição (Icon-Only + Indicador LED) */}
      <View style={styles.iconMatrixRow}>
        {allSectors.map((sector) => {
          const active = isSectorActive(sector.id);
          const selected = sector.id === inspectedSector.id;
          return (
            <Pressable
              key={sector.id}
              testID={`cad-sector-node-${sector.id}`}
              style={[
                styles.iconNode,
                active && styles.iconNodeEnabled,
                selected && styles.iconNodeSelected,
              ]}
              onPress={() => setInspectedSectorId(sector.id)}
            >
              <View style={[styles.statusDot, active ? styles.statusDotOn : styles.statusDotOff]} />
              <Text style={styles.iconNodeEmoji}>{sector.icon}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Visor Guia Interativo Central (Explica o Botão Acionado sem precisar rolar a tela) */}
      <View style={styles.guideStage} testID="cad-sector-guide-box">
        <View style={styles.guideTopRow}>
          <View style={styles.guideTitleGroup}>
            <View style={styles.guideIconBadge}>
              <Text style={{ fontSize: 20 }}>{inspectedSector.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.guideTitle}>{inspectedSector.label}</Text>
                <View style={[styles.stateBadge, isInspectedActive ? styles.stateBadgeOn : styles.stateBadgeOff]}>
                  <Text style={[styles.stateBadgeText, isInspectedActive ? styles.stateBadgeTextOn : styles.stateBadgeTextOff]}>
                    {isInspectedActive ? '● ATIVO' : '○ INATIVO'}
                  </Text>
                </View>
              </View>
              <Text style={styles.guideStepHint}>🧭 {inspectedMeta.interactiveStep}</Text>
            </View>
          </View>

          <Pressable
            testID={`cad-sector-toggle-${inspectedSector.id}`}
            disabled={isOnlyOne}
            style={[
              styles.powerBtn,
              isInspectedActive ? styles.powerBtnActive : styles.powerBtnInactive,
              isOnlyOne && { opacity: 0.45 },
            ]}
            onPress={() => !isOnlyOne && toggleSector(inspectedSector.id)}
          >
            <Text style={styles.powerBtnText}>
              {isInspectedActive ? '✓ Ligado (Desativar)' : '⚡ Ativar Módulo'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.guideSummaryText}>{inspectedMeta.guideSummary}</Text>

        {/* Chips das Calculadoras Úteis Incluídas neste Botão */}
        <View style={styles.toolsChipRow}>
          {inspectedMeta.toolsIncluded.map((toolLabel, idx) => (
            <View key={idx} style={styles.toolChip}>
              <Text style={styles.toolChipText}>{toolLabel}</Text>
            </View>
          ))}
        </View>

        <View style={styles.guideFooterRow}>
          <Text style={styles.cleanNoteText}>✨ {inspectedMeta.discardedBloatNote}</Text>
          {!compact && (
            <Pressable
              testID="cad-sector-open-metrics-btn"
              style={styles.jumpToStageBtn}
              onPress={() => router.push('/coin/metrics' as any)}
            >
              <Text style={styles.jumpToStageBtnText}>📐 Operar no Palco de Métricas ›</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  containerCompact: {
    padding: spacing.sm,
    marginVertical: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#e9d5ff',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 15,
    marginTop: 2,
  },
  iconMatrixRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    backgroundColor: colors.background.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 8,
  },
  iconNode: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.background.secondary,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconNodeEnabled: {
    borderColor: 'rgba(16, 185, 129, 0.45)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  iconNodeSelected: {
    borderColor: colors.accent.purple,
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
    transform: [{ scale: 1.06 }],
  },
  iconNodeEmoji: {
    fontSize: 21,
  },
  statusDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotOn: {
    backgroundColor: '#10b981',
  },
  statusDotOff: {
    backgroundColor: '#52525b',
  },
  guideStage: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 8,
  },
  guideTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  guideTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 200,
  },
  guideIconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text.primary,
  },
  guideStepHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c084fc',
    marginTop: 2,
  },
  stateBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  stateBadgeOn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  stateBadgeOff: {
    backgroundColor: 'rgba(113, 113, 122, 0.15)',
    borderColor: '#71717a',
  },
  stateBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  stateBadgeTextOn: {
    color: '#34d399',
  },
  stateBadgeTextOff: {
    color: '#a1a1aa',
  },
  powerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  powerBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: '#10b981',
  },
  powerBtnInactive: {
    backgroundColor: colors.accent.purple,
    borderColor: colors.accent.purple,
  },
  powerBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  guideSummaryText: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 17,
  },
  toolsChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  toolChip: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  toolChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.primary,
  },
  guideFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: 6,
  },
  cleanNoteText: {
    fontSize: 10,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  jumpToStageBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    borderWidth: 1,
    borderColor: colors.accent.purple,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  jumpToStageBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#e9d5ff',
  },
});
