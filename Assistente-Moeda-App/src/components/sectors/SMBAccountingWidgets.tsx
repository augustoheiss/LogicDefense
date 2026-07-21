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
  calculateNCG,
  calculateCFaR,
  calculatePayrollTax,
  welfordSinglePass,
  welfordSlidingWindow,
  Scenario,
} from '../../utils/smbMath';
import {
  parsePlanOfAccounts,
  AccountNode,
  ParsingAnomaly,
} from '../../utils/planOfAccountsParser';

// Sample plan of accounts to pre-populate the Tree Viewer
const SAMPLE_PLAN_OF_ACCOUNTS = `id,parent_id,level,type,nature,code,name,balance
1,,1,A,D,1.0.0.0,ATIVO,0
2,1,2,A,D,1.1.0.0,CIRCULANTE,0
3,2,3,A,D,1.1.1.0,CAIXA E EQUIVALENTES,50000
4,2,3,A,D,1.1.2.0,CONTAS A RECEBER,35000
5,1,2,A,D,1.2.0.0,NÃO CIRCULANTE,0
6,5,3,A,D,1.2.1.0,IMOBILIZADO,120000
7,,1,L,C,2.0.0.0,PASSIVO E PL,0
8,7,2,L,C,2.1.0.0,CIRCULANTE,0
9,8,3,L,C,2.1.1.0,FORNECEDORES,45000
10,8,3,L,C,2.1.2.0,EMPRÉSTIMOS DE CURTO PRAZO,15000
11,7,2,L,C,2.2.0.0,PATRIMÔNIO LÍQUIDO,0
12,11,3,L,C,2.2.1.0,CAPITAL SOCIAL,145000
13,,1,R,C,3.0.0.0,RECEITAS,0
14,13,2,R,C,3.1.0.0,RECEITA DE VENDAS,90000
15,,1,X,D,4.0.0.0,DESPESAS,0
16,15,2,X,D,4.1.0.0,CUSTO DOS SERVIÇOS PRESTADOS,32000
17,15,2,X,D,4.2.0.0,DESPESAS ADMINISTRATIVAS,14000
18,15,2,X,D,4.3.0.0,IMPOSTOS INVERTIDOS,-2500`; // anomaly intentionally included (-2500 balance on debit expense)

export function SMBAccountingWidgets() {
  // ── DRP Safety Buffer State ──
  const [demand, setDemand] = useState('1200'); // D (BRL/dia)
  const [leadTime, setLeadTime] = useState('14'); // LT (dias)
  const [sigmaD, setSigmaD] = useState('250'); // Volatilidade demanda (BRL)
  const [sigmaLT, setSigmaLT] = useState('3'); // Volatilidade lead-time (dias)
  const [serviceLevel, setServiceLevel] = useState(0.95); // 95% vs 99%

  // ── Welford Volatility State ──
  const [marginInput, setMarginInput] = useState('42,45,38,40,41,43,39,44,46,42'); // 10 historic Gross Margins (%)
  const [windowSize, setWindowSize] = useState('5');

  // ── Payroll State ──
  const [salary, setSalary] = useState('8000');
  const [ratBase, setRatBase] = useState(0.02); // 2%
  const [fap, setFap] = useState('1.0');

  // ── Plan of Accounts State ──
  const [poaText, setPoaText] = useState(SAMPLE_PLAN_OF_ACCOUNTS);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    '1': true,
    '7': true,
  });
  const [parsedPoa, setParsedPoa] = useState(() => parsePlanOfAccounts(SAMPLE_PLAN_OF_ACCOUNTS));

  // ── CFaR State ──
  const [scenariosInput, setScenariosInput] = useState(
    '0.2:30000, 0.5:55000, 0.3:75000' // prob:cashflow pairs
  );

  // ── 1. DRP safety calculations ──
  const drpResult = useMemo(() => {
    const d = parseFloat(demand) || 0;
    const lt = parseFloat(leadTime) || 0;
    const sD = parseFloat(sigmaD) || 0;
    const sLT = parseFloat(sigmaLT) || 0;
    return calculateNCG(d, lt, serviceLevel, sD, sLT);
  }, [demand, leadTime, sigmaD, sigmaLT, serviceLevel]);

  // ── 2. Welford Margin Volatility calculations ──
  const welfordResult = useMemo(() => {
    const values = marginInput
      .split(',')
      .map((v) => parseFloat(v.trim()))
      .filter((v) => !isNaN(v));

    const w = parseInt(windowSize, 10) || 5;

    const single = welfordSinglePass(values);
    const sliding = welfordSlidingWindow(values, w);

    return {
      values,
      singleMean: single.mean,
      singleStdDev: single.stdDev,
      slidingStdDevs: sliding,
      lastSliding: sliding[sliding.length - 1] ?? 0,
    };
  }, [marginInput, windowSize]);

  // ── 3. CFaR calculations ──
  const cfarResult = useMemo(() => {
    const scs: Scenario[] = scenariosInput
      .split(',')
      .map((item) => {
        const parts = item.split(':');
        const prob = parseFloat(parts[0]?.trim()) || 0;
        const cf = parseFloat(parts[1]?.trim()) || 0;
        return { probability: prob, cashFlow: cf };
      })
      .filter((s) => s.probability > 0);

    return calculateCFaR(scs);
  }, [scenariosInput]);

  // ── 4. Payroll Tax Comparison ──
  const payrollResult = useMemo(() => {
    const s = parseFloat(salary) || 0;
    const f = parseFloat(fap) || 1.0;
    return calculatePayrollTax(s, ratBase, f);
  }, [salary, ratBase, fap]);

  const handleParsePoa = () => {
    const res = parsePlanOfAccounts(poaText);
    setParsedPoa(res);
  };

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const renderAccountNode = (node: AccountNode) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = !!expandedNodes[node.id];
    const isAnomaly = parsedPoa.anomalies.some((a) => a.accountId === node.id);

    return (
      <View key={node.id} style={styles.treeNodeWrapper}>
        <View style={styles.treeNodeRow}>
          <Pressable
            style={styles.expandToggle}
            onPress={() => hasChildren && toggleNode(node.id)}
          >
            <Text style={styles.expandToggleText}>
              {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
            </Text>
          </Pressable>

          <Text style={styles.nodeCode}>{node.code}</Text>
          <Text style={[styles.nodeName, hasChildren && styles.nodeHeaderName]} numberOfLines={1}>
            {node.name}
          </Text>
          
          <Text style={styles.nodeNature}>({node.nature})</Text>

          <Text
            style={[
              styles.nodeBalance,
              isAnomaly && { color: '#f87171', fontWeight: 'bold' },
            ]}
          >
            {formatCurrencySmart(node.balance)}
          </Text>
        </View>

        {hasChildren && isExpanded && (
          <View style={styles.treeChildren}>
            {node.children.map(renderAccountNode)}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 🛡️ 1. DRP Safety Buffer Simulator */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📊 Simulador de Estoque de Segurança DRP</Text>
        <Text style={styles.widgetDescription}>
          Avalie as flutuações logísticas e de consumo para dimensionar buffers de estoque de segurança dinâmicos e mitigar rupturas.
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Demanda Média (D - R$/dia)</Text>
            <TextInput
              style={styles.textInput}
              value={demand}
              onChangeText={setDemand}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Lead-Time Médio (LT - dias)</Text>
            <TextInput
              style={styles.textInput}
              value={leadTime}
              onChangeText={setLeadTime}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Volatilidade Demanda (σD)</Text>
            <TextInput
              style={styles.textInput}
              value={sigmaD}
              onChangeText={setSigmaD}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Volatilidade Lead-Time (σLT)</Text>
            <TextInput
              style={styles.textInput}
              value={sigmaLT}
              onChangeText={setSigmaLT}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentBtn, serviceLevel === 0.95 && styles.segmentBtnActive]}
            onPress={() => setServiceLevel(0.95)}
          >
            <Text style={styles.segmentText}>Nível de Serviço 95% (Z=1.645)</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, serviceLevel === 0.99 && styles.segmentBtnActive]}
            onPress={() => setServiceLevel(0.99)}
          >
            <Text style={styles.segmentText}>Nível de Serviço 99% (Z=2.33)</Text>
          </Pressable>
        </View>

        {/* Visual Progress Bar Buffer Zone */}
        <View style={styles.bufferDisplay}>
          <Text style={styles.bufferTitle}>Distribuição Visual de Buffers DRP</Text>
          
          <View style={styles.progressBar}>
            <View style={[styles.progressSegment, { flex: drpResult.redZone, backgroundColor: '#ef4444' }]} />
            <View style={[styles.progressSegment, { flex: drpResult.yellowZone, backgroundColor: '#eab308' }]} />
            <View style={[styles.progressSegment, { flex: drpResult.greenZone, backgroundColor: '#22c55e' }]} />
          </View>

          <View style={styles.bufferLegends}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Vermelho (Estoque Segurança): {formatCurrencySmart(drpResult.safetyStock)}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#eab308' }]} />
              <Text style={styles.legendText}>Amarelo (Consumo Lead-Time): {formatCurrencySmart(drpResult.yellowZone)}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.legendText}>Verde (Lote de Ciclo): {formatCurrencySmart(drpResult.greenZone)}</Text>
            </View>
          </View>

          <View style={styles.ncgTotalCard}>
            <Text style={styles.ncgTotalLabel}>Capital de Giro Total Necessário (NCG):</Text>
            <Text style={styles.ncgTotalValue}>{formatCurrencySmart(drpResult.ncg)}</Text>
          </View>
        </View>
      </View>

      {/* 🛡️ 2. Real-Time Welford Volatility */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📈 Volatilidade de Margem (Welford Deslizante)</Text>
        <Text style={styles.widgetDescription}>
          Cálculo estatístico de volatilidade incremental em passagem única para evitar erros catastróficos de ponto flutuante.
        </Text>

        <View style={styles.inputsRow}>
          <View style={{ flex: 3, gap: 4 }}>
            <Text style={styles.inputLabel}>Histórico de Margens (%) separadas por vírgula</Text>
            <TextInput
              style={styles.textInput}
              value={marginInput}
              onChangeText={setMarginInput}
              placeholder="Ex: 40,42,39..."
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.inputLabel}>Janela (W)</Text>
            <TextInput
              style={styles.textInput}
              value={windowSize}
              onChangeText={setWindowSize}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.rowGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Média Geral (Histórico)</Text>
            <Text style={styles.statBoxValue}>{welfordResult.singleMean.toFixed(2)}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Volatilidade Total (1-Pass)</Text>
            <Text style={styles.statBoxValue}>{welfordResult.singleStdDev.toFixed(2)}%</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Volatilidade Janela (Última)</Text>
            <Text style={[styles.statBoxValue, { color: colors.accent.purple }]}>
              {welfordResult.lastSliding.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      {/* 🛡️ 2.5 Cash Flow at Risk (CFaR) */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>💵 Probabilidades de Caixa & CFaR</Text>
        <Text style={styles.widgetDescription}>
          Mapeie cenários ponderados para prever o risco máximo de variação cambial/operacional no caixa corporativo.
        </Text>

        <View style={{ gap: 4, marginBottom: spacing.sm }}>
          <Text style={styles.inputLabel}>Cenários (Probabilidade:Valor, separadas por vírgula)</Text>
          <TextInput
            style={styles.textInput}
            value={scenariosInput}
            onChangeText={setScenariosInput}
            placeholder="Ex: 0.2:30000, 0.5:55000..."
          />
        </View>

        <View style={styles.rowGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Caixa Médio Esperado</Text>
            <Text style={[styles.statBoxValue, { color: colors.success.main }]}>
              {formatCurrencySmart(cfarResult.expectedCashFlow)}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Desvio Padrão Caixa</Text>
            <Text style={styles.statBoxValue}>{formatCurrencySmart(cfarResult.stdDev)}</Text>
          </View>
        </View>
        <View style={styles.rowGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>CFaR Confiança 95%</Text>
            <Text style={[styles.statBoxValue, { color: colors.warning.main }]}>
              {formatCurrencySmart(cfarResult.cfar95)}
            </Text>
            <Text style={styles.miniLabel}>Limite mínimo com 95% de certeza</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>CFaR Confiança 99%</Text>
            <Text style={[styles.statBoxValue, { color: colors.danger.main }]}>
              {formatCurrencySmart(cfarResult.cfar99)}
            </Text>
            <Text style={styles.miniLabel}>Pior cenário extremo (99%)</Text>
          </View>
        </View>
      </View>

      {/* 🛡️ 3. Payroll Tax Comparator */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>⚖️ Encargos Trabalhistas CLT vs Benefício Fiscal</Text>
        <Text style={styles.widgetDescription}>
          Simule o custo real de contratação sob diferentes regimes. O Lucro Real permite deduzir despesas com pessoal via Benefício Fiscal (Tax Shield) de 34%.
        </Text>

        <View style={styles.inputGrid}>
          <View style={[styles.inputBox, { flex: 2 }]}>
            <Text style={styles.inputLabel}>Salário Bruto CLT (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={salary}
              onChangeText={setSalary}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputBox, { flex: 1 }]}>
            <Text style={styles.inputLabel}>FAP (0.5 a 2.0)</Text>
            <TextInput
              style={styles.textInput}
              value={fap}
              onChangeText={setFap}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentBtn, ratBase === 0.01 && styles.segmentBtnActive]}
            onPress={() => setRatBase(0.01)}
          >
            <Text style={styles.segmentText}>RAT 1% (Leve)</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, ratBase === 0.02 && styles.segmentBtnActive]}
            onPress={() => setRatBase(0.02)}
          >
            <Text style={styles.segmentText}>RAT 2% (Médio)</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, ratBase === 0.03 && styles.segmentBtnActive]}
            onPress={() => setRatBase(0.03)}
          >
            <Text style={styles.segmentText}>RAT 3% (Alto)</Text>
          </Pressable>
        </View>

        <View style={styles.comparisonGrid}>
          {/* Simples */}
          <View style={styles.comparisonColumn}>
            <Text style={styles.comparisonTitle}>Simples Nacional</Text>
            <Text style={styles.comparisonCost}>{formatCurrencySmart(payrollResult.simplesNacional.totalCost)}</Text>
            <Text style={styles.comparisonLabel}>Sem INSS Patronal</Text>
            <View style={styles.effectiveCostBox}>
              <Text style={styles.effectiveCostLabel}>Custo Efetivo:</Text>
              <Text style={styles.effectiveCostValue}>{formatCurrencySmart(payrollResult.simplesNacional.effectiveCost)}</Text>
            </View>
          </View>

          {/* Presumido */}
          <View style={styles.comparisonColumn}>
            <Text style={styles.comparisonTitle}>Lucro Presumido</Text>
            <Text style={styles.comparisonCost}>{formatCurrencySmart(payrollResult.lucroPresumido.totalCost)}</Text>
            <Text style={styles.comparisonLabel}>Com INSS + Terceiros</Text>
            <View style={styles.effectiveCostBox}>
              <Text style={styles.effectiveCostLabel}>Custo Efetivo:</Text>
              <Text style={styles.effectiveCostValue}>{formatCurrencySmart(payrollResult.lucroPresumido.effectiveCost)}</Text>
            </View>
          </View>

          {/* Real */}
          <View style={[styles.comparisonColumn, styles.comparisonColumnActive]}>
            <Text style={[styles.comparisonTitle, { color: colors.accent.purple }]}>Lucro Real</Text>
            <Text style={styles.comparisonCost}>{formatCurrencySmart(payrollResult.lucroReal.totalCost)}</Text>
            <Text style={[styles.comparisonLabel, { color: colors.success.main }]}>
              🛡️ Tax Shield: -{formatCurrencySmart(payrollResult.lucroReal.taxShield)}
            </Text>
            <View style={[styles.effectiveCostBox, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
              <Text style={styles.effectiveCostLabel}>Custo Efetivo:</Text>
              <Text style={[styles.effectiveCostValue, { color: colors.success.main }]}>
                {formatCurrencySmart(payrollResult.lucroReal.effectiveCost)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 🛡️ 4. Plan of Accounts Tree Viewer */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>🌳 Plano de Contas & Consolidação (SPED ECD)</Text>
        <Text style={styles.widgetDescription}>
          Paste ou configure a árvore contábil. O parser fará uma travessia pós-ordem consolidando saldos das folhas para os nós raízes.
        </Text>

        <TextInput
          style={styles.codeTextarea}
          multiline
          value={poaText}
          onChangeText={setPoaText}
          placeholder="id,parent_id,level,type,nature,code,name,balance..."
          placeholderTextColor={colors.text.disabled}
        />

        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={handleParsePoa}>
            <Text style={styles.actionBtnText}>🔄 Carregar / Processar Árvore</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.background.tertiary }]}
            onPress={() => {
              setPoaText(SAMPLE_PLAN_OF_ACCOUNTS);
              setParsedPoa(parsePlanOfAccounts(SAMPLE_PLAN_OF_ACCOUNTS));
            }}
          >
            <Text style={styles.actionBtnText}>Carregar Exemplo</Text>
          </Pressable>
        </View>

        {/* Anomalies alert if any */}
        {parsedPoa.anomalies.length > 0 && (
          <View style={styles.anomalyBox}>
            <Text style={styles.anomalyTitle}>⚠️ Anomalias Contábeis Detectadas ({parsedPoa.anomalies.length})</Text>
            {parsedPoa.anomalies.map((anom, idx) => (
              <Text key={idx} style={styles.anomalyItem}>
                • <Text style={{ fontWeight: 'bold' }}>{anom.code}</Text> - {anom.accountName}: {anom.description}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.treeContainer}>
          <Text style={styles.treeTitle}>Visualização da Árvore Consolidada:</Text>
          {parsedPoa.rootNodes.length === 0 ? (
            <Text style={styles.emptyTreeText}>Árvore vazia. Insira linhas de dados válidas.</Text>
          ) : (
            parsedPoa.rootNodes.map(renderAccountNode)
          )}
        </View>
      </View>
    </View>
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
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inputBox: {
    flex: 1,
    minWidth: 120,
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
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    padding: 2,
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
  },
  segmentBtnActive: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  segmentText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.primary,
  },
  bufferDisplay: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  bufferTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  progressBar: {
    height: 12,
    flexDirection: 'row',
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  progressSegment: {
    height: '100%',
  },
  bufferLegends: {
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  ncgTotalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  ncgTotalLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  ncgTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.warning.main,
    marginTop: 2,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  statBoxLabel: {
    fontSize: 8,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  statBoxValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  miniLabel: {
    fontSize: 7,
    color: colors.text.disabled,
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  comparisonColumn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
  },
  comparisonColumnActive: {
    borderColor: colors.accent.purple,
    borderWidth: 1.5,
  },
  comparisonTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.primary,
  },
  comparisonCost: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  comparisonLabel: {
    fontSize: 8,
    color: colors.text.disabled,
  },
  effectiveCostBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.sm - 2,
    padding: 4,
    marginTop: 2,
  },
  effectiveCostLabel: {
    fontSize: 7,
    color: colors.text.disabled,
  },
  effectiveCostValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
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
    height: 120,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  anomalyBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
  },
  anomalyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f87171',
  },
  anomalyItem: {
    fontSize: 10,
    color: '#fca5a5',
    lineHeight: 13,
  },
  treeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  treeTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  emptyTreeText: {
    fontSize: 10,
    color: colors.text.disabled,
    fontStyle: 'italic',
  },
  treeNodeWrapper: {
    width: '100%',
  },
  treeNodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.02)',
  },
  expandToggle: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  expandToggleText: {
    color: colors.text.disabled,
    fontSize: 10,
  },
  nodeCode: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.disabled,
    marginRight: 6,
    width: 60,
  },
  nodeName: {
    fontSize: 10,
    color: colors.text.secondary,
    flex: 1,
  },
  nodeHeaderName: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  nodeNature: {
    fontSize: 8,
    color: colors.text.disabled,
    marginRight: 10,
  },
  nodeBalance: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
    width: 90,
    textAlign: 'right',
  },
  treeChildren: {
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.05)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
