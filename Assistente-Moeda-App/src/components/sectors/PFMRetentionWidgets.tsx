import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrencySmart } from '@/core/formatCurrency';
import {
  runMonteCarloFIRE,
  predict13WeekCashFlow,
  calculateOnboardingProgress,
  generateTransactionHash,
} from '../../utils/pfmRetentionMath';
import { parsePfmCSV, PfmTransaction } from '../../utils/pfmRetentionParser';

const SAMPLE_PFM_CSV = `data_movimento,descricao_comerciante,valor_cents,categoria,meta_associada,status_consolidacao
2026-07-15,Supermercado Pao de Acucar,12050,Alimentação,Fundo de Emergência,Consolidado
2026-07-16,Posto Ipiranga Combustivel,25000,Transporte,,Pendente`;

export function PFMRetentionWidgets() {
  // ── 13-Week Cash Flow State ──
  const [initBalance, setInitBalance] = useState('10000');
  const [weeklyInc, setWeeklyInc] = useState('2500');
  const [weeklyExp, setWeeklyExp] = useState('1800');
  
  // Custom event: extra expense in week 5
  const [eventWeek, setEventWeek] = useState('5');
  const [eventAmount, setEventAmount] = useState('1500');
  const [eventIsIncome, setEventIsIncome] = useState(false);
  const [eventsList, setEventsList] = useState<{ weekIndex: number; amount: number; isIncome: boolean }[]>([
    { weekIndex: 5, amount: 1500, isIncome: false },
  ]);

  // ── Monte Carlo FIRE State ──
  const [portfolio, setPortfolio] = useState('500000');
  const [drawdown, setDrawdown] = useState('36000');
  const [meanReturn, setMeanReturn] = useState('6'); // 6%
  const [volatility, setVolatility] = useState('12'); // 12%
  const [projYears, setProjYears] = useState('30');

  // ── Sankey Flow State ──
  const [sankeyIncome, setSankeyIncome] = useState('10000');
  const [sankeyFixed, setSankeyFixed] = useState('5000');
  const [sankeyDisc, setSankeyDisc] = useState('2500');

  // ── Onboarding & Deduplication State ──
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  const [dedupDate, setDedupDate] = useState('2026-07-21');
  const [dedupAmount, setDedupAmount] = useState('15000');
  const [dedupDesc, setDedupDesc] = useState('Compra Mercado');
  const [localHashes, setLocalHashes] = useState<string[]>(['1a2b3c4d']);
  const [dedupStatus, setDedupStatus] = useState('');

  // ── CSV Importer State ──
  const [csvText, setCsvText] = useState(SAMPLE_PFM_CSV);
  const [parsedTx, setParsedTx] = useState(() => parsePfmCSV(SAMPLE_PFM_CSV));

  // ── 1. 13-Week Cash Flow Predictions ──
  const cashFlowPrediction = useMemo(() => {
    const init = parseFloat(initBalance) || 0;
    const inc = parseFloat(weeklyInc) || 0;
    const exp = parseFloat(weeklyExp) || 0;

    return predict13WeekCashFlow(init, inc, exp, eventsList);
  }, [initBalance, weeklyInc, weeklyExp, eventsList]);

  // ── 2. Monte Carlo FIRE Longevity ──
  const monteCarloResult = useMemo(() => {
    const port = parseFloat(portfolio) || 0;
    const draw = parseFloat(drawdown) || 0;
    const mean = (parseFloat(meanReturn) || 0) / 100;
    const vol = (parseFloat(volatility) || 0) / 100;
    const yrs = parseInt(projYears, 10) || 30;

    return runMonteCarloFIRE(port, draw, mean, vol, yrs, 10000);
  }, [portfolio, drawdown, meanReturn, volatility, projYears]);

  // ── 3. Onboarding Progress ──
  const onboardingResult = useMemo(() => {
    return calculateOnboardingProgress(completedStepIds);
  }, [completedStepIds]);

  // ── 4. Sankey Flow simulation calculations ──
  const sankeyCalculations = useMemo(() => {
    const inc = parseFloat(sankeyIncome) || 0;
    const fixed = parseFloat(sankeyFixed) || 0;
    const disc = parseFloat(sankeyDisc) || 0;
    const invest = Math.max(0, inc - fixed - disc);

    const fixedPct = inc > 0 ? (fixed / inc) * 100 : 0;
    const discPct = inc > 0 ? (disc / inc) * 100 : 0;
    const investPct = inc > 0 ? (invest / inc) * 100 : 0;

    return {
      invest,
      fixedPct,
      discPct,
      investPct,
    };
  }, [sankeyIncome, sankeyFixed, sankeyDisc]);

  const handleAddEvent = () => {
    const w = parseInt(eventWeek, 10) || 1;
    const a = parseFloat(eventAmount) || 0;
    if (a > 0) {
      setEventsList([...eventsList, { weekIndex: w, amount: a, isIncome: eventIsIncome }]);
    }
  };

  const handleTestDeduplication = () => {
    const amt = parseFloat(dedupAmount) || 0;
    const hash = generateTransactionHash(dedupDate, amt, dedupDesc);
    const isDup = localHashes.includes(hash);

    if (isDup) {
      setDedupStatus(`❌ Transação Duplicada! Hash match: [${hash}]. Re-importação rejeitada para proteger suas métricas.`);
    } else {
      setDedupStatus(`✅ Transação Única! Hash: [${hash}]. Lançamento consolidado no cofre local.`);
      setLocalHashes([...localHashes, hash]);
    }
  };

  const handleParsePfm = () => {
    const res = parsePfmCSV(csvText);
    setParsedTx(res);
    // Add parsed transaction hashes to deduplicator list
    const newHashes = res.transactions.map((t) => t.txHash);
    setLocalHashes((prev) => [...prev, ...newHashes]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* 🏁 Onboarding progress effect (Endowed Progress) */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🏁 Progresso de Integração Ativa (Meta-Gradiente)</Text>
        <Text style={styles.widgetDescription}>
          Onboarding dinâmico baseado em recompensa psicológica. O cofre gerado no dispositivo pré-conclui etapas básicas para diminuir o esforço percebido.
        </Text>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Progresso de Setup:</Text>
          <Text style={styles.progressPercent}>{onboardingResult.progressPercent.toFixed(0)}%</Text>
        </View>
        <View style={styles.barWrapper}>
          <View
            style={[
              styles.barVisual,
              { width: `${onboardingResult.progressPercent}%`, backgroundColor: colors.accent.purple },
            ]}
          />
        </View>

        <View style={styles.checklist}>
          {onboardingResult.steps.map((step) => (
            <Pressable
              key={step.id}
              style={styles.checkRow}
              onPress={() => {
                if (step.id !== 'vault_creation' && step.id !== 'key_generation') {
                  if (completedStepIds.includes(step.id)) {
                    setCompletedStepIds(completedStepIds.filter((id) => id !== step.id));
                  } else {
                    setCompletedStepIds([...completedStepIds, step.id]);
                  }
                }
              }}
            >
              <Text style={styles.checkIcon}>{step.completed ? '🟩' : '⬛'}</Text>
              <Text style={[styles.checkText, step.completed && styles.checkCompleted]}>
                {step.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 📈 1. 13-Week Cash Flow & Buffer Predictor */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📈 Fluxo de Caixa Projetado (Janela Deslizante de 13 Semanas)</Text>
        <Text style={styles.widgetDescription}>
          Antecipe faltas de caixa no trimestre. Modifique as entradas recorrentes e adicione eventos esporádicos para traçar a evolução do seu saldo disponível.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Saldo Disponível (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={initBalance}
              onChangeText={setInitBalance}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Receita Semanal (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={weeklyInc}
              onChangeText={setWeeklyInc}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Despesa Semanal (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={weeklyExp}
              onChangeText={setWeeklyExp}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Add custom one-time event */}
        <View style={styles.addEventBox}>
          <Text style={styles.sectionTitle}>Adicionar Lançamento Avulso:</Text>
          <View style={styles.rowGrid}>
            <TextInput
              style={[styles.textInput, { width: 50 }]}
              value={eventWeek}
              onChangeText={setEventWeek}
              placeholder="Sem."
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.textInput, { flex: 2 }]}
              value={eventAmount}
              onChangeText={setEventAmount}
              placeholder="Valor R$"
              keyboardType="numeric"
            />
            <Pressable
              style={[styles.typeBtn, !eventIsIncome && styles.typeBtnActive]}
              onPress={() => setEventIsIncome(false)}
            >
              <Text style={styles.typeBtnText}>Despesa</Text>
            </Pressable>
            <Pressable
              style={[styles.typeBtn, eventIsIncome && styles.typeBtnActive]}
              onPress={() => setEventIsIncome(true)}
            >
              <Text style={styles.typeBtnText}>Receita</Text>
            </Pressable>
            <Pressable style={styles.addBtn} onPress={handleAddEvent}>
              <Text style={styles.addBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* 13-Week timeline forecast */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timelineScroll}>
          {cashFlowPrediction.map((week) => (
            <View key={week.weekIndex} style={[styles.timelineCard, week.isNegative && styles.timelineCardAlert]}>
              <Text style={styles.timelineWeek}>{week.dateStr}</Text>
              <Text style={[styles.timelineBal, week.isNegative && { color: colors.danger.main }]}>
                {formatCurrencySmart(week.projectedBalance)}
              </Text>
              <Text style={styles.timelineFlow}>+ {formatCurrencySmart(week.revenue)}</Text>
              <Text style={[styles.timelineFlow, { color: colors.warning.main }]}>
                - {formatCurrencySmart(week.expenses)}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 🎲 2. Monte Carlo FIRE Simulator */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🎲 Simulação Estocástica de Monte Carlo (Estabilidade FIRE)</Text>
        <Text style={styles.widgetDescription}>
          Teste a robustez da sua estratégia de aposentadoria contra o risco de sequência de retornos ruins. A simulação projeta 10.000 trajetórias anuais de mercado.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Patrimônio Acumulado (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={portfolio}
              onChangeText={setPortfolio}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Retirada Anual (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={drawdown}
              onChangeText={setDrawdown}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Retorno Real Médio (%)</Text>
            <TextInput
              style={styles.textInput}
              value={meanReturn}
              onChangeText={setMeanReturn}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Volatilidade Ativos (%)</Text>
            <TextInput
              style={styles.textInput}
              value={volatility}
              onChangeText={setVolatility}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Anos Projeção</Text>
            <TextInput
              style={styles.textInput}
              value={projYears}
              onChangeText={setProjYears}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Probabilidade de Sucesso (Sobrevivência):</Text>
          <Text
            style={[
              styles.resultValue,
              {
                color:
                  monteCarloResult.successRate > 80
                    ? colors.success.main
                    : monteCarloResult.successRate > 50
                    ? colors.warning.main
                    : colors.danger.main,
              },
            ]}
          >
            {monteCarloResult.successRate.toFixed(1)}%
          </Text>
          <Text style={styles.resultSub}>
            Resultado Mediano Esperado: {formatCurrencySmart(monteCarloResult.medianEndingWealth)}
          </Text>
          <Text style={styles.resultSub}>
            Pior Cenário Histórico (P10): {formatCurrencySmart(monteCarloResult.p10EndingWealth)}
          </Text>
        </View>
      </View>

      {/* 🌊 3. Visual Sankey Flow Chart */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🌊 Alocação do Fluxo Financeiro (Representação de Sankey)</Text>
        <Text style={styles.widgetDescription}>
          Visualize a distribuição da sua renda bruta dividida em despesas obrigatórias, discricionárias e investimentos.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Renda Mensal (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={sankeyIncome}
              onChangeText={setSankeyIncome}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Custos Fixos (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={sankeyFixed}
              onChangeText={setSankeyFixed}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Despesas Flexíveis (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={sankeyDisc}
              onChangeText={setSankeyDisc}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.flowDiagram}>
          {/* Gross income node */}
          <View style={styles.diagramNode}>
            <Text style={styles.nodeName}>Entrada Bruta</Text>
            <Text style={styles.nodeAmount}>{formatCurrencySmart(parseFloat(sankeyIncome) || 0)}</Text>
          </View>

          {/* Flow connections */}
          <View style={styles.flowPaths}>
            <View style={styles.flowBar}>
              <Text style={styles.flowLabel}>Despesas Fixas ({sankeyCalculations.fixedPct.toFixed(0)}%)</Text>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.barVisual,
                    { width: `${sankeyCalculations.fixedPct}%`, backgroundColor: colors.danger.main },
                  ]}
                />
              </View>
            </View>

            <View style={styles.flowBar}>
              <Text style={styles.flowLabel}>Despesas Flexíveis ({sankeyCalculations.discPct.toFixed(0)}%)</Text>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.barVisual,
                    { width: `${sankeyCalculations.discPct}%`, backgroundColor: colors.warning.main },
                  ]}
                />
              </View>
            </View>

            <View style={styles.flowBar}>
              <Text style={styles.flowLabel}>Aporte/Investimento ({sankeyCalculations.investPct.toFixed(0)}%)</Text>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.barVisual,
                    { width: `${sankeyCalculations.investPct}%`, backgroundColor: colors.success.main },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 🛡️ 4. Local Deduplication Tester */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🛡️ Testador de Deduplicação por Hash Local</Text>
        <Text style={styles.widgetDescription}>
          Simule a importação de transações recorrentes. O algoritmo evita dados duplicados sem comunicação externa.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Data Lançamento</Text>
            <TextInput
              style={styles.textInput}
              value={dedupDate}
              onChangeText={setDedupDate}
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Valor (Cents)</Text>
            <TextInput
              style={styles.textInput}
              value={dedupAmount}
              onChangeText={setDedupAmount}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Descrição</Text>
            <TextInput
              style={styles.textInput}
              value={dedupDesc}
              onChangeText={setDedupDesc}
            />
          </View>
        </View>

        <Pressable style={styles.actionBtn} onPress={handleTestDeduplication}>
          <Text style={styles.actionBtnText}>Testar Importação</Text>
        </Pressable>

        {dedupStatus !== '' && (
          <View style={styles.tipBanner}>
            <Text style={styles.tipText}>{dedupStatus}</Text>
          </View>
        )}
      </View>

      {/* 📥 5. CSV PFM Parser */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📥 Reconciliação PFM Completa (CSV)</Text>
        <Text style={styles.widgetDescription}>
          Submeta demonstrativos de metas e gastos para popular os simuladores atuarial e de fluxo de caixa de 13 semanas de forma local.
        </Text>

        <TextInput
          style={styles.codeTextarea}
          multiline
          value={csvText}
          onChangeText={setCsvText}
          placeholder="data_movimento,descricao_comerciante..."
          placeholderTextColor={colors.text.disabled}
        />

        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={handleParsePfm}>
            <Text style={styles.actionBtnText}>🔄 Conciliar Transações</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.background.tertiary }]}
            onPress={() => {
              setCsvText(SAMPLE_PFM_CSV);
              setParsedTx(parsePfmCSV(SAMPLE_PFM_CSV));
            }}
          >
            <Text style={styles.actionBtnText}>Restaurar Exemplo</Text>
          </Pressable>
        </View>

        {parsedTx.transactions.length > 0 && (
          <View style={styles.txsList}>
            <Text style={styles.sectionTitle}>Lançamentos PFM Reconciliados:</Text>
            {parsedTx.transactions.map((tx, index) => (
              <View key={index} style={styles.txRow}>
                <View style={styles.txMeta}>
                  <Text style={styles.txName}>{tx.descricaoComerciante}</Text>
                  <Text style={styles.txCat}>{tx.categoria} | Hash: {tx.txHash}</Text>
                </View>
                <Text style={styles.txVal}>{formatCurrencySmart(tx.valorCents / 100)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  widgetCard: {
    backgroundColor: colors.background.primary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  widgetHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  widgetDescription: {
    fontSize: 11,
    color: colors.text.disabled,
    lineHeight: 14,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  barWrapper: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  barVisual: {
    height: '100%',
  },
  checklist: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  checkIcon: {
    fontSize: 12,
  },
  checkText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  checkCompleted: {
    textDecorationLine: 'line-through',
    color: colors.text.disabled,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inputBox: {
    flex: 1,
    minWidth: 100,
    gap: 4,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  textInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    color: colors.text.primary,
    fontSize: 11,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 30,
  },
  addEventBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.primary,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  typeBtn: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  typeBtnActive: {
    backgroundColor: colors.accent.purple,
  },
  typeBtnText: {
    fontSize: 9,
    color: colors.text.primary,
    fontWeight: '600',
  },
  addBtn: {
    backgroundColor: colors.success.main,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  timelineScroll: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  timelineCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    width: 100,
    marginRight: spacing.sm,
    gap: 4,
  },
  timelineCardAlert: {
    borderColor: colors.danger.main,
    backgroundColor: 'rgba(239, 68, 68, 0.02)',
  },
  timelineWeek: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.primary,
  },
  timelineBal: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timelineFlow: {
    fontSize: 9,
    color: colors.success.main,
  },
  resultBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    gap: 4,
  },
  resultLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  resultValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  resultSub: {
    fontSize: 9,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: 2,
  },
  flowDiagram: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
  },
  diagramNode: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
  },
  nodeName: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  nodeAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  flowPaths: {
    flex: 1,
    gap: spacing.xs,
  },
  flowBar: {
    gap: 4,
  },
  flowLabel: {
    fontSize: 9,
    color: colors.text.secondary,
  },
  actionBtn: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  tipBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: 4,
  },
  tipText: {
    fontSize: 10,
    color: colors.text.secondary,
    lineHeight: 13,
  },
  codeTextarea: {
    backgroundColor: '#0d1117',
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: '#a5d6ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    padding: spacing.sm,
    height: 100,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  txsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  txMeta: {
    flex: 1,
    gap: 2,
  },
  txName: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.primary,
  },
  txCat: {
    fontSize: 8,
    color: colors.text.disabled,
  },
  txVal: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
  },
});
