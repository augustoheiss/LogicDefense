import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { HojeCockpitSummary } from '@sekundo/core';

export interface HojeWidgetsGridProps {
  summary: HojeCockpitSummary;
  showWidget: (id: string) => boolean;
  onRunOutput: (kind: 'pdf' | 'whatsapp' | 'csv' | 'yaml', template?: string) => void;
  onOpenStudioPreset: (preset: 'fichas-4up' | 'territorios-multiciclo') => void;
}

export function HojeWidgetsGrid({
  summary,
  showWidget,
  onRunOutput,
  onOpenStudioPreset,
}: HojeWidgetsGridProps) {
  const router = useRouter();
  return (
    <View style={styles.widgetsGrid}>
      {showWidget('compromissos_do_dia') && (
        <View style={styles.card} testID="widget-compromissos">
          <Text style={styles.cardTitle}>
            📅 Compromissos do Dia ({summary.compromissosDoDia.length})
          </Text>
          {summary.compromissosDoDia.slice(0, 5).map((c) => (
            <View key={c.key} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemPrimary}>
                  {c.assignee}
                  {c.assistant ? ` + ${c.assistant}` : ''}
                </Text>
                <Text style={styles.itemSecondary}>
                  [{c.key}] {c.partTitle} • {c.room}
                </Text>
              </View>
              <Text style={styles.itemBadge}>{c.date}</Text>
            </View>
          ))}
        </View>
      )}

      {showWidget('mensagens_a_enviar') && (
        <View style={styles.card} testID="widget-mensagens">
          <Text style={styles.cardTitle}>
            💬 Mensagens a Enviar ({summary.mensagensAEnviar.length})
          </Text>
          {summary.mensagensAEnviar.slice(0, 4).map((m, idx) => (
            <View key={`${m.recipient}-${idx}`} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemPrimary}>{m.recipient}</Text>
                <Text style={styles.itemSecondary}>{m.summary}</Text>
              </View>
              <TouchableOpacity
                style={styles.actionPill}
                onPress={() => onRunOutput('whatsapp', 'meu_compromisso')}
              >
                <Text style={styles.actionPillText}>Gerar Zap</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {showWidget('documentos_a_imprimir') && (
        <View style={styles.card} testID="widget-documentos">
          <Text style={styles.cardTitle}>
            🖨️ Documentos & Saídas Unificadas ({summary.documentosAImprimir.length})
          </Text>
          {summary.documentosAImprimir.map((d, idx) => (
            <View key={`${d.pranchetaId}-${idx}`} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemPrimary}>
                  [{d.kind.toUpperCase()}] {d.template}
                </Text>
                <Text style={styles.itemSecondary}>{d.pranchetaNome}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  testID={`hoje-run-${d.kind}-${idx}`}
                  style={styles.actionPillPrimary}
                  onPress={() => onRunOutput(d.kind, d.template)}
                >
                  <Text style={styles.actionPillText}>Baixar</Text>
                </TouchableOpacity>
                {d.kind === 'pdf' && (
                  <TouchableOpacity
                    style={styles.actionPill}
                    onPress={() =>
                      onOpenStudioPreset(
                        d.template.includes('territorio') || d.template.includes('multiciclo')
                          ? 'territorios-multiciclo'
                          : 'fichas-4up'
                      )
                    }
                  >
                    <Text style={styles.actionPillText}>Estúdio</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {showWidget('territorios_vencendo') && (
        <View style={styles.card} testID="widget-territorios">
          <Text style={styles.cardTitle}>
            🗺️ Territórios em Atenção / Recência ({summary.territoriosVencendo.length})
          </Text>
          {summary.territoriosVencendo.slice(0, 5).map((t) => (
            <View key={t.territoryNumber} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemPrimary}>
                  {t.territoryNumber} — {t.label}
                </Text>
                <Text style={styles.itemSecondary}>
                  {t.daysSinceCompleted} dias desde última conclusão ({t.percent}% concluído)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.actionPill}
                onPress={() => onOpenStudioPreset('territorios-multiciclo')}
              >
                <Text style={styles.actionPillText}>Registro Multi-Ciclo</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card} testID="widget-coin-engine">
        <Text style={styles.cardTitle}>🪙 Engine Financeira (Assistente Moeda)</Text>
        <View style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemPrimary}>Planilhas, 8 Setores CAD, Turso & API Pública</Text>
            <Text style={styles.itemSecondary}>
              Fluxo de Caixa, Receita, Custos 50/30/20, FIRE, PME, Imóveis SAC, Frotas e Fiscal
            </Text>
          </View>
          <TouchableOpacity
            testID="hoje-open-coin-engine"
            style={styles.actionPillPrimary}
            onPress={() => router.push('/coin' as any)}
          >
            <Text style={styles.actionPillText}>Abrir 🪙</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widgetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  card: {
    flex: 1,
    minWidth: 300,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 8,
  },
  itemPrimary: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  itemSecondary: { color: '#94A3B8', fontSize: 11 },
  itemBadge: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  actionPill: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
  },
  actionPillPrimary: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
  },
  actionPillText: { color: '#F8FAFC', fontSize: 11, fontWeight: '600' },
});
