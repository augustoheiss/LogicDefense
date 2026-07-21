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
  calculateAltmanZScore,
  calculateBeneishAQI,
  calculateFinancialRatios,
  validateDoubleEntryLedger,
} from '../../utils/auditMath';
import {
  parseGeneralLedger,
  GLEntry,
  AccountAuditTrail,
} from '../../utils/generalLedgerParser';

// Sample General Ledger CSV
const SAMPLE_GENERAL_LEDGER = `transaction_id,timestamp,debit_account,credit_account,amount_in_cents,description,reversal_ref_id
TX101,2026-07-01T09:00:00Z,1.1.1.0,1.2.1.0,1500000,Venda de ativo imobilizado,
TX102,2026-07-02T10:00:00Z,4.1.0.0,1.1.1.0,200000,Compra suprimentos à vista,
TX103,2026-07-03T11:00:00Z,1.1.1.0,3.1.0.0,850000,Adiantamento cliente projeto,
TX104,2026-07-04T14:30:00Z,4.2.0.0,1.1.1.0,400000,Erro de digitação duplicado,
TX105,2026-07-04T15:00:00Z,1.1.1.0,4.2.0.0,400000,Estorno de lançamento duplicado,TX104
TX106,2026-07-05T16:00:00Z,1.1.2.0,3.1.0.0,1200000,Venda faturada a prazo,
TX107,2026-07-06T09:00:00Z,1.1.1.0,1.1.2.0,500000,Recebimento parcial cliente,`;

export function LegalAuditWidgets() {
  // ── Altman Z-Score State ──
  const [wc, setWc] = useState('80000'); // Working Capital
  const [re, setRe] = useState('45000'); // Retained Earnings
  const [ebit, setEbit] = useState('25000'); // EBIT
  const [equity, setEquity] = useState('145000'); // Net Worth (Patrimônio Líquido)
  const [assets, setAssets] = useState('250000'); // Total Assets
  const [liabilities, setLiabilities] = useState('105000'); // Total Liabilities
  const [sales, setSales] = useState('90000'); // Sales

  // ── Beneish M-Score (AQI) State ──
  const [caT, setCaT] = useState('130000'); // Current Assets T
  const [faT, setFaT] = useState('120000'); // Fixed Assets T
  const [invT, setInvT] = useState('0'); // Investments T
  const [taT, setTaT] = useState('250000'); // Total Assets T
  const [caPrev, setCaPrev] = useState('110000'); // Current Assets T-1
  const [faPrev, setFaPrev] = useState('120000'); // Fixed Assets T-1
  const [invPrev, setInvPrev] = useState('0'); // Investments T-1
  const [taPrev, setTaPrev] = useState('230000'); // Total Assets T-1

  // ── General Ledger State ──
  const [glText, setGlText] = useState(SAMPLE_GENERAL_LEDGER);
  const [parsedGl, setParsedGl] = useState(() => parseGeneralLedger(SAMPLE_GENERAL_LEDGER));
  const [selectedAccount, setSelectedAccount] = useState('1.1.1.0'); // Caixa e equivalentes

  // ── Altman & Beneish calculations ──
  const altmanResult = useMemo(() => {
    return calculateAltmanZScore(
      (parseFloat(wc) || 0) * 100,
      (parseFloat(re) || 0) * 100,
      (parseFloat(ebit) || 0) * 100,
      (parseFloat(equity) || 0) * 100,
      (parseFloat(assets) || 0) * 100,
      (parseFloat(liabilities) || 0) * 100,
      (parseFloat(sales) || 0) * 100
    );
  }, [wc, re, ebit, equity, assets, liabilities, sales]);

  const beneishResult = useMemo(() => {
    return calculateBeneishAQI(
      (parseFloat(caT) || 0) * 100,
      (parseFloat(faT) || 0) * 100,
      (parseFloat(invT) || 0) * 100,
      (parseFloat(taT) || 0) * 100,
      (parseFloat(caPrev) || 0) * 100,
      (parseFloat(faPrev) || 0) * 100,
      (parseFloat(invPrev) || 0) * 100,
      (parseFloat(taPrev) || 0) * 100
    );
  }, [caT, faT, invT, taT, caPrev, faPrev, invPrev, taPrev]);

  // ── Integrated Ratios ──
  const ratiosResult = useMemo(() => {
    return calculateFinancialRatios(
      (parseFloat(caT) || 0) * 100,
      ((parseFloat(liabilities) || 0) * 0.6) * 100, // mock current liabilities as 60% of total
      ((parseFloat(caT) || 0) * 0.7) * 100, // mock cash & receivables
      (parseFloat(wc) || 0) * 0.3 * 100, // mock receivables
      (parseFloat(sales) || 0) * 0.8 * 100, // mock credit sales
      (parseFloat(liabilities) || 0) * 100,
      (parseFloat(equity) || 0) * 100,
      (parseFloat(sales) || 0) * 0.45 * 100, // mock gross profit (45%)
      (parseFloat(sales) || 0) * 100,
      (parseFloat(ebit) || 0) * 1.15 * 100 // mock ebitda
    );
  }, [caT, liabilities, wc, sales, equity, ebit]);

  const handleParseGL = () => {
    const res = parseGeneralLedger(glText);
    setParsedGl(res);
    // Auto select first available account if current selection is not available
    const keys = Array.from(res.accountTrails.keys());
    if (keys.length > 0 && !keys.includes(selectedAccount)) {
      setSelectedAccount(keys[0]);
    }
  };

  const selectedTrail = useMemo(() => {
    return parsedGl.accountTrails.get(selectedAccount) || null;
  }, [parsedGl, selectedAccount]);

  return (
    <View style={styles.container}>
      {/* ⚖️ 1. Solvency & Integrity Meter (Altman & Beneish) */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>⚖️ Saúde Financeira & Score de Solvência</Text>
        <Text style={styles.widgetDescription}>
          Avaliação preditiva de risco de insolvência corporativa (Altman Z-Score) combinada com índice de desvio de capitalização de ativos (Beneish AQI).
        </Text>

        <View style={styles.inputGrid}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Cap. Giro (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={wc}
              onChangeText={setWc}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Lucros Retidos (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={re}
              onChangeText={setRe}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>EBIT (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={ebit}
              onChangeText={setEbit}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Patrimônio Líq. (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={equity}
              onChangeText={setEquity}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Ativos Totais (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={assets}
              onChangeText={setAssets}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>Passivo Total (R$)</Text>
            <TextInput
              style={styles.textInput}
              value={liabilities}
              onChangeText={setLiabilities}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Visual Solvency Dial */}
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Altman Z-Score PMEs:</Text>
          <Text
            style={[
              styles.resultValue,
              {
                color:
                  altmanResult.zone === 'safe'
                    ? colors.success.main
                    : altmanResult.zone === 'grey'
                    ? colors.warning.main
                    : colors.danger.main,
              },
            ]}
          >
            {altmanResult.score.toFixed(2)}
          </Text>
          <Text
            style={[
              styles.badgeText,
              {
                color:
                  altmanResult.zone === 'safe'
                    ? colors.success.main
                    : altmanResult.zone === 'grey'
                    ? colors.warning.main
                    : colors.danger.main,
              },
            ]}
          >
            {altmanResult.description}
          </Text>
          
          {/* Stacked gauge bar representing the Z-Score */}
          <View style={styles.progressBar}>
            <View style={[styles.progressSegment, { flex: 1.1, backgroundColor: '#ef4444' }]} />
            <View style={[styles.progressSegment, { flex: 1.5, backgroundColor: '#eab308' }]} />
            <View style={[styles.progressSegment, { flex: 2.4, backgroundColor: '#22c55e' }]} />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Beneish AQI calculations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}> Beneish AQI (Qualidade dos Ativos)</Text>
          <Text style={styles.widgetDescription}>
            Compara a proporção de ativos intangíveis e diferidos para detectar manipulação contábil entre dois exercícios contábeis.
          </Text>

          <View style={styles.rowGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>Asset Quality Index (AQI)</Text>
              <Text
                style={[
                  styles.statBoxValue,
                  { color: beneishResult.manipulationRisk ? colors.warning.main : colors.success.main },
                ]}
              >
                {beneishResult.aqi.toFixed(3)}
              </Text>
            </View>
          </View>
          <Text
            style={[
              styles.legendText,
              {
                color: beneishResult.manipulationRisk ? '#f87171' : colors.text.secondary,
                fontWeight: beneishResult.manipulationRisk ? '700' : 'normal',
              },
            ]}
          >
            {beneishResult.description}
          </Text>
        </View>
      </View>

      {/* ⚖️ 2. Double-Entry General Ledger Validator & Ratios */}
      <View style={styles.widgetCard}>
        <Text style={styles.widgetHeader}>📥 Validador Contábil do Livro Razão (GL)</Text>
        <Text style={styles.widgetDescription}>
          Insira lançamentos diários contábeis para auditar a regra fundamental de partidas dobradas (Soma dos Débitos = Soma dos Créditos).
        </Text>

        <TextInput
          style={styles.codeTextarea}
          multiline
          value={glText}
          onChangeText={setGlText}
          placeholder="transaction_id,timestamp,debit_account,credit_account,amount_in_cents..."
          placeholderTextColor={colors.text.disabled}
        />

        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={handleParseGL}>
            <Text style={styles.actionBtnText}>🔄 Reconciliar & Analisar GL</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.background.tertiary }]}
            onPress={() => {
              setGlText(SAMPLE_GENERAL_LEDGER);
              setParsedGl(parseGeneralLedger(SAMPLE_GENERAL_LEDGER));
            }}
          >
            <Text style={styles.actionBtnText}>Carregar Padrão</Text>
          </Pressable>
        </View>

        {/* Balance status banner */}
        <View
          style={[
            styles.statusBanner,
            parsedGl.isBalanced ? styles.statusBannerSuccess : styles.statusBannerError,
          ]}
        >
          <Text style={styles.statusBannerTitle}>
            {parsedGl.isBalanced ? '✅ Balanço Equilibrado' : '❌ Diferença no Balanço'}
          </Text>
          <Text style={styles.statusBannerText}>
            Total Débitos: {formatCurrencySmart(parsedGl.totalDebitsCents / 100)} | Total Créditos:{' '}
            {formatCurrencySmart(parsedGl.totalCreditsCents / 100)}
          </Text>
          {!parsedGl.isBalanced && (
            <Text style={styles.statusBannerText}>
              Diferença: {formatCurrencySmart((parsedGl.totalDebitsCents - parsedGl.totalCreditsCents) / 100)}
            </Text>
          )}
        </View>

        {/* Errors list if any */}
        {parsedGl.errors.length > 0 && (
          <View style={styles.anomalyBox}>
            <Text style={styles.anomalyTitle}>⚠️ Alertas Contábeis ({parsedGl.errors.length})</Text>
            {parsedGl.errors.map((err, idx) => (
              <Text key={idx} style={styles.anomalyItem}>
                • {err}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {/* Ratio Cards */}
        <Text style={styles.sectionTitle}>📊 Rácios de Liquidez & Eficiência</Text>
        <View style={styles.rowGrid}>
          <View style={styles.ratioCard}>
            <Text style={styles.ratioLabel}>Rácio Corrente</Text>
            <Text style={[styles.ratioValue, { color: colors.info.main }]}>
              {ratiosResult.currentRatio.toFixed(2)}
            </Text>
            <Text style={styles.ratioSub}>Ativo Circ. / Passivo Circ.</Text>
          </View>

          <View style={styles.ratioCard}>
            <Text style={styles.ratioLabel}>Rácio Ácido</Text>
            <Text style={[styles.ratioValue, { color: colors.info.main }]}>
              {ratiosResult.quickRatio.toFixed(2)}
            </Text>
            <Text style={styles.ratioSub}>Liquidez imediata</Text>
          </View>
        </View>

        <View style={styles.rowGrid}>
          <View style={styles.ratioCard}>
            <Text style={styles.ratioLabel}>DSO (Prazo Recebimento)</Text>
            <Text style={[styles.ratioValue, { color: colors.warning.main }]}>
              {ratiosResult.dso.toFixed(0)} dias
            </Text>
            <Text style={styles.ratioSub}>Giro de contas a receber</Text>
          </View>

          <View style={styles.ratioCard}>
            <Text style={styles.ratioLabel}>Debt to Equity (D/E)</Text>
            <Text style={[styles.ratioValue, { color: colors.danger.main }]}>
              {ratiosResult.debtToEquity.toFixed(2)}
            </Text>
            <Text style={styles.ratioSub}>Passivo total / PL</Text>
          </View>
        </View>
      </View>

      {/* ⚖️ 3. Account Data Lineage Tracer */}
      {parsedGl.entries.length > 0 && (
        <View style={styles.widgetCard}>
          <Text style={styles.widgetHeader}>🌳 Rastreabilidade & Data Lineage Contábil</Text>
          <Text style={styles.widgetDescription}>
            Selecione uma conta para reconstruir a proveniência dos saldos, auditando estornos e lançamentos de retificação de forma visual.
          </Text>

          {/* Account Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accSelectorRow}>
            {Array.from(parsedGl.accountTrails.keys()).map((accCode) => (
              <Pressable
                key={accCode}
                style={[
                  styles.accSelectorBtn,
                  selectedAccount === accCode && styles.accSelectorBtnActive,
                ]}
                onPress={() => setSelectedAccount(accCode)}
              >
                <Text style={styles.accSelectorText}>{accCode}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {selectedTrail ? (
            <View style={styles.lineageContainer}>
              <View style={styles.lineageHeader}>
                <Text style={styles.lineageTitle}>Trilha de Auditoria: {selectedAccount}</Text>
                <Text style={styles.lineageSubtitle}>
                  Saldo Final: {formatCurrencySmart(selectedTrail.currentBalanceCents / 100)}
                </Text>
              </View>

              <View style={styles.historyList}>
                {selectedTrail.history.map((tx, idx) => {
                  const entryDetail = parsedGl.entries.find((e) => e.transactionId === tx.transactionId);
                  const isStorno = tx.isStorno;
                  const isReversed = entryDetail?.isReversed;

                  return (
                    <View key={tx.transactionId} style={styles.historyItemWrapper}>
                      {/* Visual connector line */}
                      {idx < selectedTrail.history.length - 1 && <View style={styles.historyLine} />}

                      <View style={styles.historyDotContainer}>
                        <View
                          style={[
                            styles.historyDot,
                            {
                              backgroundColor:
                                tx.type === 'debit'
                                  ? colors.success.main
                                  : colors.danger.main,
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.historyContent}>
                        <View style={styles.historyRow}>
                          <Text style={styles.historyTxId}>{tx.transactionId}</Text>
                          <Text style={styles.historyTimestamp}>
                            {new Date(tx.timestamp).toLocaleTimeString('pt-BR')}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.historyDesc,
                            isReversed && styles.strikethroughText,
                          ]}
                        >
                          {tx.description}
                        </Text>

                        <View style={styles.historyRow}>
                          <Text style={styles.historyCounter}>Contra: {tx.counterpart}</Text>
                          <Text
                            style={[
                              styles.historyValue,
                              {
                                color:
                                  tx.type === 'debit'
                                    ? colors.success.main
                                    : colors.danger.main,
                              },
                            ]}
                          >
                            {tx.type === 'debit' ? '+' : '-'}
                            {formatCurrencySmart(tx.amountInCents / 100)}
                          </Text>
                        </View>

                        {/* Badges/Alerts */}
                        {isStorno && (
                          <View style={styles.badgeStorno}>
                            <Text style={styles.badgeStornoText}>
                              ↩️ ESTORNO (Reverte: {tx.reversalRefId})
                            </Text>
                          </View>
                        )}

                        {isReversed && (
                          <View style={styles.badgeReversed}>
                            <Text style={styles.badgeReversedText}>
                              ⚠️ REVERTIDO POR: {entryDetail?.reversedBy}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <Text style={styles.emptyTreeText}>Selecione uma conta para auditar.</Text>
          )}
        </View>
      )}
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
    fontSize: 20,
    fontWeight: '700',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  progressBar: {
    height: 8,
    width: '80%',
    flexDirection: 'row',
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginTop: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  progressSegment: {
    height: '100%',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
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
    alignItems: 'center',
  },
  statBoxLabel: {
    fontSize: 8,
    color: colors.text.secondary,
  },
  statBoxValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  legendText: {
    fontSize: 10,
    color: colors.text.secondary,
    textAlign: 'center',
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
  statusBanner: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  statusBannerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  statusBannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  statusBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statusBannerText: {
    fontSize: 10,
    color: colors.text.secondary,
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
  },
  ratioCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  ratioLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  ratioValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  ratioSub: {
    fontSize: 8,
    color: colors.text.disabled,
  },
  accSelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  accSelectorBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  accSelectorBtnActive: {
    backgroundColor: colors.accent.purple,
    borderColor: colors.accent.purpleBorder,
  },
  accSelectorText: {
    fontSize: 10,
    color: colors.text.primary,
    fontWeight: '600',
  },
  lineageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.md,
  },
  lineageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: spacing.sm,
  },
  lineageTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },
  lineageSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success.main,
  },
  historyList: {
    paddingLeft: spacing.xs,
  },
  historyItemWrapper: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  historyLine: {
    position: 'absolute',
    left: 4,
    top: 10,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  historyDotContainer: {
    width: 10,
    alignItems: 'center',
    paddingTop: 4,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyContent: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTxId: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.accent.purpleLight || '#e9d5ff',
    fontWeight: '700',
  },
  historyTimestamp: {
    fontSize: 8,
    color: colors.text.disabled,
  },
  historyDesc: {
    fontSize: 10,
    color: colors.text.primary,
    fontWeight: '500',
  },
  historyCounter: {
    fontSize: 8,
    color: colors.text.disabled,
  },
  historyValue: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  badgeStorno: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  badgeStornoText: {
    fontSize: 8,
    color: '#93c5fd',
    fontWeight: '700',
  },
  badgeReversed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  badgeReversedText: {
    fontSize: 8,
    color: '#fca5a5',
    fontWeight: '700',
  },
  strikethroughText: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  emptyTreeText: {
    fontSize: 10,
    color: colors.text.disabled,
    fontStyle: 'italic',
  },
});
